// Run inside Tabbit only. No screenshots or asset changes during measured windows.
const fs = await import("node:fs/promises");
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
    dpr: devicePixelRatio,
    viewport: { width: innerWidth, height: innerHeight },
    hardwareMobile: false,
    foregroundPolicy: "preserve",
  };
});
const results = [];
for (const quality of ["high", "low"]) {
  await page.evaluate((q) => {
    window.artLab.setQuality(q);
    window.artLab.setTime("day");
    window.artLab.setView("overview");
  }, quality);
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.artLab.clearMetrics());
  await page.waitForTimeout(20000);
  const state = await page.evaluate(() => window.artLab.snapshot());
  results.push({
    sampleSeconds: 20,
    quality,
    medianFPS: state.medianFPS,
    p95ms: state.p95ms,
    drawingBuffer: state.drawingBuffer,
    drawCalls: state.drawCalls,
    trianglesAllPasses: state.trianglesAllPasses,
    geometryCount: state.geometries,
    textureCount: state.textures,
    meetsMedian: state.medianFPS >= (quality === "high" ? 30 : 59),
    meetsP95: state.p95ms <= (quality === "high" ? 50 : 25),
  });
}
const report = {
  createdAt: new Date().toISOString(),
  environment,
  results,
  limitations: [
    "20-second steady daytime samples on the listed desktop only.",
    "No screenshot export or LOD/time switching during samples.",
    "Phone hardware and thermal/long-running stress not tested.",
  ],
};
const path = artifactPath("city-v2-performance.json");
await fs.writeFile(path, JSON.stringify(report, null, 2));
return { path, ...report };
