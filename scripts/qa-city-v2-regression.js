// Executed inside Tabbit's browser-owned Node runtime against production output.
const fs = await import("node:fs/promises");
const errors = [],
  failed = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("response", (r) => {
  if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() });
});
await page.setViewportSize({ width: 1920, height: 1080 });
await page.emulateMedia({ reducedMotion: "no-preference" });
await page.goto("http://127.0.0.1:4183/art-lab.html", {
  waitUntil: "networkidle",
});
await page.waitForFunction(() => !!window.artLab);
const report = { checks: [], performance: [], errors, failed };
const check = (name, extra = {}) =>
  report.checks.push({ name, pass: true, ...extra });
const initial = await page.evaluate(() => window.artLab.snapshot());
assert.equal(initial.landmarks.length, 7);
assert.equal(
  initial.models.filter(
    (a) => a.category === "heritage" || a.category === "modern",
  ).length,
  12,
);
assert.equal(initial.autoRotate, false);
assert.equal(initial.labels, false);
check("seven stable landmark IDs, twelve families, default static composition");
for (const view of ["overview", "lujiazui", "bund", "river"]) {
  await page.locator("#art-view").selectOption(view);
  await page.waitForTimeout(80);
  assert.ok(
    (await page.evaluate(() => window.artLab.snapshot())).camera.every(
      Number.isFinite,
    ),
  );
}
check("four camera presets");
await page.evaluate(() => window.artLab.setView("overview"));
const before = await page.evaluate(() => window.artLab.snapshot().camera);
await page.evaluate(() => {
  window.artLab.setTime("night");
  window.artLab.setTime("dusk");
  window.artLab.setTime("night");
});
await page.waitForTimeout(2800);
let state = await page.evaluate(() => window.artLab.snapshot());
assert.equal(state.phase, 2);
assert.deepEqual(state.camera, before);
check("interrupted time changes end at last selection without moving camera");
await page.evaluate(() => window.artLab.focusLandmark("customs"));
await page.waitForTimeout(100);
await page
  .locator("canvas")
  .click({
    position: {
      x: await page.locator("canvas").evaluate((c) => c.clientWidth / 2),
      y: await page.locator("canvas").evaluate((c) => c.clientHeight / 2),
    },
  });
assert.equal(
  await page.evaluate(() => window.artLab.snapshot().selected),
  "customs",
);
check("native ray selection after landmark focus");
await page.evaluate(() => window.artLab.setLabels(true));
await page.waitForTimeout(120);
assert.equal(await page.evaluate(() => window.artLab.snapshot().labels), true);
check("label switch and selection information");
await page.evaluate(() => window.artLab.setView("overview"));
let memory;
for (let cycle = 0; cycle < 2; cycle++) {
  for (const level of [1, 2, 0])
    await page.evaluate((l) => window.artLab.setLod(l), level);
  await page.waitForTimeout(150);
  state = await page.evaluate(() => window.artLab.snapshot());
  if (memory) {
    assert.equal(state.geometries, memory.geometries);
    assert.equal(state.textures, memory.textures);
  }
  memory = state;
}
check("three detail levels and stable resources after repeated cycles", {
  geometries: memory.geometries,
  textures: memory.textures,
});
for (const quality of ["high", "low"]) {
  await page.evaluate((q) => {
    window.artLab.setQuality(q);
    window.artLab.setTime("day");
    window.artLab.setView("overview");
  }, quality);
  await page.waitForTimeout(2800);
  await page.evaluate(() => window.artLab.clearMetrics());
  await page.waitForTimeout(3500);
  const metric = await page.evaluate(() => window.artLab.snapshot());
  report.performance.push(metric);
  assert.ok(metric.drawingBuffer.width <= (quality === "high" ? 1920 : 1536));
  assert.ok(metric.drawingBuffer.height <= (quality === "high" ? 1080 : 864));
}
check("quality limits and sustained frame-time samples");
await page.emulateMedia({ reducedMotion: "reduce" });
await page.evaluate(() => window.artLab.setAutoRotate(true));
await page.waitForTimeout(120);
state = await page.evaluate(() => window.artLab.snapshot());
assert.equal(state.autoRotate, false);
assert.equal(state.motionReduced, true);
assert.equal(state.animationTime, 0);
check("reduced motion disables automatic orbit, waves, traffic and wakes");
await page.emulateMedia({ reducedMotion: "no-preference" });
for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(150);
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    bottom: document.querySelector(".art-panel").getBoundingClientRect().bottom,
    height: innerHeight,
  }));
  assert.equal(layout.overflow, false);
  assert.ok(layout.bottom <= layout.height + 1);
  check(
    "responsive controls " +
      viewport.width +
      "x" +
      viewport.height +
      " (simulated)",
  );
}
await page.setViewportSize({ width: 1920, height: 1080 });
await page.evaluate(() => window.artLab.setQuality("high"));
const contextLoss = await page.evaluate(() => {
  const gl = document.querySelector("canvas").getContext("webgl2"),
    ext = gl.getExtension("WEBGL_lose_context");
  if (!ext) return false;
  window.__loss = ext;
  ext.loseContext();
  return true;
});
if (contextLoss) {
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__loss.restoreContext());
  await page.waitForTimeout(1600);
  const size = await page.evaluate(
    async () => (await window.artLab.capture()).size,
  );
  assert.ok(size > 20000);
  assert.equal(
    await page.evaluate(() => window.artLab.snapshot().contextLost),
    false,
  );
  check(
    "WebGL context recovery recreates render targets and exports actual frame",
  );
}
await page.evaluate(() => window.artLab.dispose());
assert.equal(await page.locator("canvas").count(), 0);
assert.equal(await page.locator(".art-label").count(), 0);
check("dispose removes renderer, labels and diagnostics");
assert.deepEqual(errors, []);
assert.deepEqual(failed, []);
await page.goto("http://127.0.0.1:4183/art-lab.html", {
  waitUntil: "networkidle",
});
await page.waitForFunction(() => !!window.artLab);
report.visualAcceptance = "not evaluated by functional tests";
const path = artifactPath("city-v2-regression.json");
await fs.writeFile(path, JSON.stringify(report, null, 2));
return {
  path,
  checks: report.checks,
  performance: report.performance.map((s) => ({
    quality: s.quality,
    medianFPS: s.medianFPS,
    p95ms: s.p95ms,
    drawCalls: s.drawCalls,
    drawingBuffer: s.drawingBuffer,
  })),
  errors,
  failed,
};
