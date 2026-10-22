// Fault injection uses a separate owned page and restores the route in finally.
const fs = await import("node:fs/promises");
await page.route("**/renovation/v2/models/customs-lod0.glb", (route) =>
  route.fulfill({
    status: 404,
    body: "Intentional asset fault for local regression",
  }),
);
let fault;
try {
  await page.goto("http://127.0.0.1:4183/art-lab.html", {
    waitUntil: "networkidle",
  });
  await expect(page.locator("#art-status")).toHaveAttribute(
    "data-error",
    "true",
  );
  const status = await page.locator("#art-status").innerText();
  assert.match(status, /customs/);
  assert.equal(await page.locator("canvas").count(), 0);
  assert.equal(await page.evaluate(() => !!window.artLab), false);
  fault = { status, noPlaceholderCanvas: true };
} finally {
  await page.unroute("**/renovation/v2/models/customs-lod0.glb");
}
await page.goto("http://127.0.0.1:4183/art-lab.html", {
  waitUntil: "networkidle",
});
await page.waitForFunction(() => !!window.artLab);
assert.equal(await page.locator("canvas").count(), 1);
const result = {
  createdAt: new Date().toISOString(),
  fault,
  normalReload: true,
};
const path = artifactPath("city-v2-missing-asset.json");
await fs.writeFile(path, JSON.stringify(result, null, 2));
return { path, ...result };
