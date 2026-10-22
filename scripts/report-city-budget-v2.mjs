import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
const root = path.resolve(import.meta.dirname, "..");
const read = async (p) =>
  JSON.parse(await fs.readFile(path.join(root, p), "utf8"));
const models = await read("public/assets/renovation/v2/models/manifest.json");
const art = await read("art/renovation/v2/manifest.json");
const active = new Set([
  ...models.assets.flatMap((a) => a.artIds),
  "V205",
  "V206",
  "V207",
  "V208",
  "V209",
  "V210",
  "V212",
]);
const textureFiles = art.assets
  .filter((a) => active.has(a.id))
  .map((a) => "public/" + a.runtime.path);
for (const id of ["V201", "V202", "V211"])
  textureFiles.push(`public/assets/renovation/v2/textures/${id}-windows.png`);
const textures = [];
for (const file of textureFiles) {
  const m = await sharp(path.join(root, file)).metadata();
  textures.push({
    file,
    width: m.width,
    height: m.height,
    bytes: (await fs.stat(path.join(root, file))).size,
    estimatedRGBA8WithMipmaps: Math.ceil((m.width * m.height * 4 * 4) / 3),
  });
}
// City.load starts core assets at LOD0, distant instances at LOD2; props use LOD0.
const initialModelFiles = models.assets.flatMap((a) =>
  a.lods.filter(
    (l) =>
      l.level === 0 ||
      (l.level === 2 && ["heritage", "modern"].includes(a.category)),
  ),
);
async function directoryBytes(dir) {
  let total = 0;
  for (const entry of await fs.readdir(path.join(root, dir), {
    withFileTypes: true,
  })) {
    const p = path.join(dir, entry.name);
    total += entry.isDirectory()
      ? await directoryBytes(p)
      : (await fs.stat(path.join(root, p))).size;
  }
  return total;
}
function targets(w, h, high) {
  const entries = [],
    add = (name, width, height, bpp, count = 1) =>
      entries.push({
        name,
        width,
        height,
        count,
        estimatedBytes: width * height * bpp * count,
      });
  // Local installed Three.js defaults: RGBA16F composer/bloom/SMAA/reflection;
  // reserve 4 bytes per depth pixel, even when a driver uses 24-bit storage.
  add("composer RGBA16F + depth", w, h, 12, 2);
  add(
    "normal RGBA8 + depth texture (allocated in both qualities)",
    Math.floor(w / 2),
    Math.floor(h / 2),
    8,
  );
  add(
    "reflection RGBA16F + depth, no MSAA",
    Math.floor(w / (high ? 2 : 4)),
    Math.floor(h / (high ? 2 : 4)),
    12,
  );
  add("SMAA edges and weights RGBA16F", w, h, 8, 2);
  let bw = Math.round(w / 2),
    bh = Math.round(h / 2);
  add("bloom bright RGBA16F + depth", bw, bh, 12);
  for (let i = 0; i < 5; i++) {
    add("bloom blur level " + i, bw, bh, 12, 2);
    bw = Math.round(bw / 2);
    bh = Math.round(bh / 2);
  }
  add("shadow RGBA8 + depth", high ? 2048 : 1024, high ? 2048 : 1024, 8);
  // Conservative extra allowance: main antialiased drawing buffer, depth and
  // browser double buffering. Driver/compositor allocation is not observable.
  add("drawing buffer allowance incl. MSAA/compositor", w, h, 48);
  return entries;
}
const textureEstimate = textures.reduce(
  (s, t) => s + t.estimatedRGBA8WithMipmaps,
  0,
);
let bundleBytes = 0;
for (const entry of await fs.readdir(path.join(root, "dist/assets"), {
  withFileTypes: true,
}))
  if (entry.isFile())
    bundleBytes += (await fs.stat(path.join(root, "dist/assets", entry.name)))
      .size;
const report = {
  createdAt: new Date().toISOString(),
  scope:
    "V2 runtime assets; source .blend, imagegen originals, review screenshots excluded from runtime transfer",
  units: "bytes; budget MB is decimal; MiB display uses 1048576",
  firstScreenConservativeUncompressedBytes:
    initialModelFiles.reduce((s, l) => s + l.bytes, 0) +
    textures.reduce((s, t) => s + t.bytes, 0) +
    bundleBytes,
  v2AllRuntimeBytes: await directoryBytes("public/assets/renovation/v2"),
  allPublicRuntimeBytes: await directoryBytes("public"),
  blenderSourceBytes: models.assets.reduce((s, a) => s + a.sourceBytes, 0),
  textures,
  estimatedTextureBytes: textureEstimate,
  qualities: [],
};
for (const [quality, w, h, high] of [
  ["high", 1920, 1080, true],
  ["low", 1536, 864, false],
]) {
  const renderTargets = targets(w, h, high),
    estimatedTotalBytes =
      textureEstimate +
      renderTargets.reduce((s, r) => s + r.estimatedBytes, 0) +
      4 * 1024 * 1024;
  report.qualities.push({
    quality,
    drawingBuffer: { width: w, height: h },
    renderTargets,
    auxiliaryTextureAllowanceBytes: 4 * 1024 * 1024,
    estimatedTotalBytes,
    within512MB: estimatedTotalBytes <= 512000000,
  });
}
report.limitations = [
  "Texture/render-target estimate, not measured VRAM; excludes geometry buffers and unknown driver overhead.",
  "Initial bytes are a conservative uncompressed file sum, not a cold-network measurement.",
  "All public runtime includes preserved legacy/V1 assets; current V2 first screen does not load those assets.",
  "Physical mobile hardware not tested.",
];
await fs.writeFile(
  path.join(root, "output/art-renovation/v2/budget.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    firstScreenMB: report.firstScreenConservativeUncompressedBytes / 1e6,
    v2RuntimeMB: report.v2AllRuntimeBytes / 1e6,
    allRuntimeMB: report.allPublicRuntimeBytes / 1e6,
    blenderSourceMB: report.blenderSourceBytes / 1e6,
    qualities: report.qualities.map((q) => ({
      quality: q.quality,
      estimatedTextureAndTargetsMB: q.estimatedTotalBytes / 1e6,
    })),
  }),
);
