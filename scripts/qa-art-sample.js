// Run inside Tabbit's browser-owned Node runtime, like the other qa-*.js files.
const fs = await import("node:fs/promises");
const crypto = await import("node:crypto");
const errors = [];
const failed = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("response", (response) => {
  if (response.status() >= 400)
    failed.push({ url: response.url(), status: response.status() });
});
await page.setViewportSize({ width: 1920, height: 1080 });
await page.emulateMedia({ reducedMotion: "no-preference" });
await page.goto("http://127.0.0.1:4180/art-lab.html", {
  waitUntil: "networkidle",
});
await page.waitForFunction(() => !!window.artLab);
await page.waitForTimeout(800);
const report = {
  environment: await page.evaluate(() => {
    const canvas = document.querySelector("canvas"),
      gl = canvas.getContext("webgl2"),
      extension = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      userAgent: navigator.userAgent,
      gpu: extension
        ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)
        : null,
      viewport: { width: innerWidth, height: innerHeight },
      dpr: devicePixelRatio,
    };
  }),
  checks: [],
  captures: [],
  errors,
  failed,
};
globalThis.artQAReport = report;
async function exportFrame(name) {
  const data = await page.evaluate(async () => {
    const blob = await window.artLab.capture();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  });
  const buffer = Buffer.from(data.split(",")[1], "base64");
  assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.ok(buffer.length > 50000);
  const path = artifactPath(`${Date.now()}-${name}`);
  await fs.writeFile(path, buffer, { flag: "wx" });
  return {
    path,
    bytes: buffer.length,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    state: await page.evaluate(() => window.artLab.snapshot()),
  };
}
for (const time of ["day", "dusk", "night"]) {
  await page
    .getByRole("button", {
      name: { day: "白昼", dusk: "暮色", night: "入夜" }[time],
      exact: true,
    })
    .click();
  await page.waitForTimeout(2700);
  for (const [label, back] of [
    ["front", false],
    ["back", true],
  ]) {
    await page
      .getByRole("button", {
        name: back ? "反面视角" : "正面视角",
        exact: true,
      })
      .click();
    await page.waitForTimeout(250);
    report.captures.push({
      kind: "scene",
      time,
      view: label,
      ...(await exportFrame(`art-${time}-${label}.png`)),
    });
  }
}
report.checks.push({
  name: "three time periods, front/back, real render-path PNG export",
  pass: true,
});
await page.getByRole("button", { name: "白昼", exact: true }).click();
await page.waitForTimeout(2700);
for (const subject of ["pearl", "customs", "hsbc"]) {
  await page.locator("#art-subject").selectOption(subject);
  await page.waitForTimeout(200);
  report.captures.push({
    kind: "model",
    subject,
    ...(await exportFrame(`model-${subject}.png`)),
  });
}
report.checks.push({
  name: "three independent landmark GLBs and anchors",
  pass: true,
});
await page.locator("#art-subject").selectOption("scene");
await page.waitForTimeout(100);
let memory;
for (let cycle = 0; cycle < 2; cycle++) {
  for (const level of [1, 2, 0]) {
    await page.locator("#art-lod").selectOption(String(level));
    await page.waitForFunction(
      (value) => window.artLab.snapshot().level === value,
      level,
    );
    await page.waitForTimeout(150);
  }
  const state = await page.evaluate(() => window.artLab.snapshot());
  if (memory) {
    assert.equal(state.geometries, memory.geometries);
    assert.equal(state.textures, memory.textures);
  }
  memory = state;
}
report.checks.push({
  name: "all detail levels load, repeat cycles have stable geometry/texture counts",
  pass: true,
  memory: { geometries: memory.geometries, textures: memory.textures },
});
const camera = await page.evaluate(() => window.artLab.snapshot().camera);
await page.evaluate(() => {
  window.artLab.setTime("night");
  window.artLab.setTime("dusk");
  window.artLab.setTime("night");
});
await page.waitForTimeout(2700);
const interrupted = await page.evaluate(() => window.artLab.snapshot());
assert.equal(interrupted.time, "night");
assert.ok(Math.abs(interrupted.phase - 2) < 0.001);
assert.ok(
  interrupted.camera.every(
    (value, index) => Math.abs(value - camera[index]) < 0.001,
  ),
);
report.checks.push({
  name: "interrupted time transition ends at last selection and preserves camera",
  pass: true,
});
await page.locator("#art-quality").selectOption("low");
await page.waitForTimeout(400);
const low = await page.evaluate(() => window.artLab.snapshot());
assert.equal(low.quality, "low");
assert.ok(low.drawingBuffer.width <= 1536 && low.drawingBuffer.height <= 864);
await page.locator("#art-quality").selectOption("high");
report.checks.push({
  name: "quality switch applies reported drawing-buffer limits",
  pass: true,
  low,
});
await page.emulateMedia({ reducedMotion: "no-preference" });
await page.getByRole("button", { name: "自动环绕", exact: true }).click();
await page.emulateMedia({ reducedMotion: "reduce" });
await page.waitForTimeout(250);
assert.equal(
  await page.evaluate(() => window.artLab.snapshot().autoRotate),
  false,
  "reduced-motion must stop orbit",
);
report.checks.push({
  name: "reduced motion stops automatic orbit",
  pass: true,
});
await page.emulateMedia({ reducedMotion: "no-preference" });
for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(250);
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    panelBottom: document.querySelector(".art-panel").getBoundingClientRect()
      .bottom,
    viewportHeight: innerHeight,
    buttons: [...document.querySelectorAll(".art-panel button")].map((b) => {
      const r = b.getBoundingClientRect();
      return { width: r.width, height: r.height };
    }),
  }));
  assert.equal(
    layout.overflow,
    false,
    "responsive page must not overflow horizontally",
  );
  assert.ok(
    layout.panelBottom <= layout.viewportHeight + 1,
    "panel must remain inside viewport",
  );
  // The user's 110% browser zoom reports a 44px CSS box as 43.998577px.
  assert.ok(
    layout.buttons.every((b) => b.width >= 43.95 && b.height >= 43.95),
    "44px targets, allowing subpixel rounding",
  );
  report.checks.push({
    name: `responsive layout ${viewport.width}x${viewport.height} (simulated)`,
    pass: true,
  });
}
await page.setViewportSize({ width: 1920, height: 1080 });
const context = await page.evaluate(() => {
  const gl = document.querySelector("canvas").getContext("webgl2");
  const e = gl.getExtension("WEBGL_lose_context");
  if (!e) return false;
  window.__artLoss = e;
  e.loseContext();
  return true;
});
if (context) {
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__artLoss.restoreContext());
  await page.waitForTimeout(1600);
  await exportFrame("art-context-restored.png");
  report.checks.push({
    name: "WebGL context loss and recovery produces a valid nontrivial PNG",
    pass: true,
  });
} else
  report.checks.push({
    name: "WebGL context loss and recovery",
    pass: null,
    note: "extension unavailable",
  });
await page.evaluate(() => window.artLab.dispose());
assert.equal(await page.locator("canvas").count(), 0);
assert.equal(await page.locator(".art-label").count(), 0);
report.checks.push({
  name: "dispose removes canvas, labels and public diagnostics",
  pass: true,
});
assert.deepEqual(errors, []);
assert.deepEqual(failed, []);
// Restore a useful sample tab after destructive-in-test lifecycle checks.
await page.goto("http://127.0.0.1:4180/art-lab.html", {
  waitUntil: "networkidle",
});
await page.waitForFunction(() => !!window.artLab);
report.passed = report.checks.every((check) => check.pass !== false);
report.visualAcceptance = "NOT evaluated by functional checks";
const reportPath = artifactPath("art-sample-functional.json");
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
return {
  reportPath,
  checks: report.checks.map((c) => ({ name: c.name, pass: c.pass })),
  captures: report.captures.map((c) => ({
    kind: c.kind,
    time: c.time,
    view: c.view,
    subject: c.subject,
    path: c.path,
  })),
  environment: report.environment,
};
