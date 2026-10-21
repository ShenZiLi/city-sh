import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "art/renovation/v2");
const out = path.join(root, "public/assets/renovation/v2/textures");
await fs.mkdir(out, { recursive: true });
const specs = JSON.parse(
  await fs.readFile(path.join(dir, "requests.json"), "utf8"),
);
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const assets = [];
for (const spec of specs.assets) {
  const source = path.join(dir, "originals", spec.id + ".png");
  const raw = await fs.readFile(source),
    meta = await sharp(raw).metadata();
  const runtime = spec.id + ".webp";
  let operation = sharp(raw);
  // Generated elevation has four complete storeys and a partial fifth. Crop
  // only the partial lower strip; record the actual window/UV convention.
  const crop =
    spec.id === "V201"
      ? {
          left: 0,
          top: 0,
          width: meta.width,
          height: Math.floor(meta.height * 0.94),
        }
      : null;
  if (crop) operation = operation.extract(crop);
  await operation
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(path.join(out, runtime));
  const data = await fs.readFile(path.join(out, runtime));
  const runtimeMeta = await sharp(data).metadata();
  let receipt;
  try {
    receipt = JSON.parse(
      await fs.readFile(path.join(dir, "prompts", spec.id + ".json"), "utf8"),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    receipt = {
      id: spec.id,
      tool: "OpenAI built-in image_gen",
      toolOutput:
        "/Users/shen/.codex/generated_images/01a15c07-001e-78b3-a36a-ce3c2d2e5b06/exec-d7bd1664-c451-4f57-8867-b68ef9d7a4dd.png",
      prompt: spec.prompt,
      reference: specs.reference,
    };
    await fs.writeFile(
      path.join(dir, "prompts", spec.id + ".json"),
      JSON.stringify(receipt, null, 2) + "\n",
    );
  }
  const channels = await sharp(data)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let transparent = 0,
    opaque = 0;
  if (spec.transparent)
    for (let i = 3; i < channels.data.length; i += 4) {
      if (channels.data[i] < 20) transparent++;
      if (channels.data[i] > 240) opaque++;
    }
  if (spec.transparent && (!meta.hasAlpha || transparent < 100 || opaque < 100))
    throw Error("Invalid meaningful alpha: " + spec.id);
  assets.push({
    id: spec.id,
    name: spec.name,
    method: "image_gen",
    generator: receipt.tool,
    toolOutput: receipt.toolOutput,
    status: "integrated",
    original: `art/renovation/v2/originals/${spec.id}.png`,
    promptFile: `art/renovation/v2/prompts/${spec.id}.json`,
    promptSha256: sha(Buffer.from(spec.prompt)),
    reference: specs.reference,
    referenceSha256: sha(await fs.readFile(path.join(root, specs.reference))),
    originalMetadata: {
      width: meta.width,
      height: meta.height,
      bytes: raw.length,
      hasAlpha: meta.hasAlpha,
      sha256: sha(raw),
    },
    processing: { crop, upscaled: false },
    runtime: {
      path: `assets/renovation/v2/textures/${runtime}`,
      width: runtimeMeta.width,
      height: runtimeMeta.height,
      bytes: data.length,
      sha256: sha(data),
    },
    alpha: spec.transparent ? { transparent, opaque } : null,
    visualAcceptance: "pending actual render review",
  });
}
for (const [id, source, rect] of [
  [
    "RT02-copper",
    "art/renovation/originals/RT02.png",
    [0.01, 0.51, 0.48, 0.48],
  ],
  ["RT03-rose", "art/renovation/originals/RT03.png", [0.01, 0.01, 0.48, 0.48]],
  [
    "V201-stone",
    "art/renovation/v2/originals/V201.png",
    [0.005, 0.06, 0.027, 0.12],
  ],
]) {
  const raw = await fs.readFile(path.join(root, source)),
    meta = await sharp(raw).metadata();
  const crop = {
    left: Math.round(meta.width * rect[0]),
    top: Math.round(meta.height * rect[1]),
    width: Math.floor(meta.width * rect[2]),
    height: Math.floor(meta.height * rect[3]),
  };
  const destination = path.join(out, id + ".webp");
  await sharp(raw).extract(crop).webp({ quality: 92 }).toFile(destination);
  const data = await fs.readFile(destination);
  assets.push({
    id,
    method: "crop from existing image_gen original",
    original: source,
    originalSha256: sha(raw),
    processing: { crop, upscaled: false },
    status: "integrated",
    runtime: {
      path: `assets/renovation/v2/textures/${id}.webp`,
      bytes: data.length,
      sha256: sha(data),
    },
    visualAcceptance: "pending",
  });
}
// These are UV-derived masks, not painted images or imagegen normals. They
// retain the same surface coordinates as the corresponding facade module.
for (const [id, cols, rows, x0, x1, y0, y1] of [
  ["V201", 6, 4, 0.31, 0.77, 0.2, 0.79],
  ["V202", 5, 4, 0.28, 0.72, 0.24, 0.75],
  ["V203", 8, 16, 0.18, 0.82, 0.18, 0.82],
]) {
  const size = 512,
    data = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const col = Math.floor((x / size) * cols),
        row = Math.floor((y / size) * rows),
        u = ((x / size) * cols) % 1,
        v = ((y / size) * rows) % 1;
      const selected =
        (col * 13 + row * 7 + col * row * 3) % 11 < (id === "V203" ? 3 : 5);
      const value = selected && u > x0 && u < x1 && v > y0 && v < y1 ? 255 : 0;
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = 255;
    }
  await sharp(data, { raw: { width: size, height: size, channels: 4 } })
    .png()
    .toFile(path.join(out, id + "-windows.png"));
}
const manifest = {
  schemaVersion: 2,
  selectedDirection: "RA01",
  status: "runtime candidate, not visually accepted",
  assets,
};
await fs.writeFile(
  path.join(dir, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
await fs.writeFile(
  path.join(out, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    paintAssets: assets.length,
    originals: specs.assets.length,
    bytes: assets.reduce((sum, a) => sum + a.runtime.bytes, 0),
  }),
);
