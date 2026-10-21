// Executed only inside Tabbit's browser-owned Node runtime.
const fs = await import("node:fs/promises"),
  crypto = await import("node:crypto");
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
const environment = await page.evaluate(() => {
  const gl = document.querySelector("canvas").getContext("webgl2"),
    e = gl.getExtension("WEBGL_debug_renderer_info");
  return {
    userAgent: navigator.userAgent,
    gpu: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : null,
    viewport: { width: innerWidth, height: innerHeight },
    dpr: devicePixelRatio,
  };
});
const report = {
  environment,
  captures: [],
  errors,
  failed,
  visualAcceptance:
    "requires human review; screenshots are unmodified render-path PNGs",
};
async function capture(name, kind, details = {}) {
  const data = await page.evaluate(async () => {
    const b = await window.artLab.capture();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(b);
    });
  });
  const bytes = Buffer.from(data.split(",")[1], "base64");
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.ok(bytes.length > 20000);
  const path = artifactPath(name + ".png");
  await fs.writeFile(path, bytes);
  report.captures.push({
    name,
    kind,
    ...details,
    path,
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    state: await page.evaluate(() => window.artLab.snapshot()),
  });
}
for (const time of ["day", "dusk", "night"]) {
  await page.evaluate((t) => {
    window.artLab.setView("overview");
    window.artLab.setTime(t);
  }, time);
  await page.waitForTimeout(2900);
  await page.evaluate(() => window.artLab.clearMetrics());
  await page.waitForTimeout(2200);
  await capture(time + "-main", "main", { time });
  for (let index = 0; index < 8; index++) {
    await page.evaluate(
      (angle) => window.artLab.setAngle(angle),
      -22.9 + index * 45,
    );
    await page.waitForTimeout(150);
    await capture(time + "-orbit-" + index, "orbit", {
      time,
      index,
      angle: -22.9 + index * 45,
    });
  }
}
await page.evaluate(() => window.artLab.setTime("day"));
await page.waitForTimeout(2700);
for (const id of [
  "pearl",
  "shanghai",
  "swfc",
  "jinmao",
  "customs",
  "hsbc",
  "peace",
]) {
  await page.evaluate((id) => window.artLab.setSubject(id), id);
  await page.waitForTimeout(200);
  await capture("model-" + id, "model", { id });
}
await page.evaluate(() => window.artLab.setSubject("scene"));
assert.deepEqual(errors, []);
assert.deepEqual(failed, []);
const reportPath = artifactPath("city-v2-captures.json");
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
return {
  reportPath,
  environment,
  captures: report.captures.map(({ name, path, bytes }) => ({
    name,
    path,
    bytes,
  })),
  main: report.captures
    .filter((c) => c.kind === "main")
    .map(({ name, state }) => ({
      name,
      metrics: {
        medianFPS: state.medianFPS,
        p95ms: state.p95ms,
        drawCalls: state.drawCalls,
        drawingBuffer: state.drawingBuffer,
      },
    })),
};
