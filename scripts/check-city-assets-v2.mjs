import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
const root = path.resolve(import.meta.dirname, ".."),
  sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const read = async (p) => fs.readFile(path.join(root, p));
const art = JSON.parse(await read("art/renovation/v2/manifest.json"));
const models = JSON.parse(
  await read("public/assets/renovation/v2/models/manifest.json"),
);
const requests = JSON.parse(await read("art/renovation/v2/requests.json"));
const expected = new Set([
  "pearl",
  "shanghai",
  "swfc",
  "jinmao",
  "customs",
  "hsbc",
  "peace",
  ...Array.from({ length: 6 }, (_, i) => "heritage-" + i),
  ...Array.from({ length: 6 }, (_, i) => "modern-" + i),
  "boat-0",
  "boat-1",
  "bridge",
]);
const ids = new Set();
let modelBytes = 0;
for (const asset of art.assets) {
  if (ids.has(asset.id)) throw Error("Duplicate paint " + asset.id);
  ids.add(asset.id);
  const original = await read(asset.original),
    runtime = await read("public/" + asset.runtime.path),
    meta = await sharp(original).metadata();
  if (
    sha(original) !==
      (asset.originalMetadata?.sha256 ?? asset.originalSha256) ||
    sha(runtime) !== asset.runtime.sha256
  )
    throw Error("Paint hash mismatch " + asset.id);
  if (
    asset.originalMetadata &&
    (meta.width !== asset.originalMetadata.width ||
      meta.height !== asset.originalMetadata.height)
  )
    throw Error("Actual image dimensions differ " + asset.id);
  if (asset.method === "image_gen") {
    const spec = requests.assets.find((s) => s.id === asset.id),
      receipt = JSON.parse(await read(asset.promptFile));
    if (
      !spec ||
      sha(Buffer.from(spec.prompt)) !== asset.promptSha256 ||
      receipt.prompt !== spec.prompt ||
      !receipt.toolOutput.includes("/generated_images/")
    )
      throw Error("Missing actual generation provenance " + asset.id);
    if (sha(await read(asset.reference)) !== asset.referenceSha256)
      throw Error("Reference changed " + asset.id);
    if (
      spec.transparent &&
      (!meta.hasAlpha || !asset.alpha?.transparent || !asset.alpha?.opaque)
    )
      throw Error("Meaningful alpha missing " + asset.id);
  }
  if (asset.status === "accepted" && !asset.visualEvidence?.length)
    throw Error("Visual acceptance requires evidence " + asset.id);
}
let files = 0;
for (const asset of models.assets) {
  if (!expected.delete(asset.id))
    throw Error("Unexpected or duplicate architecture " + asset.id);
  const source = await read(asset.source);
  if (source.length !== asset.sourceBytes || sha(source) !== asset.sourceSha256)
    throw Error("Blender source mismatch " + asset.id);
  for (const id of asset.artIds)
    if (!ids.has(id)) throw Error("Unrecorded paint " + id);
  let previous = Infinity;
  for (const lod of asset.lods) {
    const bytes = await read("public/" + lod.path);
    if (
      bytes.readUInt32LE(0) !== 0x46546c67 ||
      bytes.readUInt32LE(8) !== bytes.length ||
      sha(bytes) !== lod.sha256
    )
      throw Error("Invalid geometry " + lod.path);
    const doc = JSON.parse(
      bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
    );
    for (const name of ["label-anchor", "focus-anchor"])
      if (!doc.nodes.some((n) => n.name === name))
        throw Error("Missing anchor " + asset.id + " " + name);
    if (doc.images?.length)
      throw Error(
        "Paints should be shared, not duplicated into each GLB " + asset.id,
      );
    const triangles = doc.meshes.reduce(
      (s, m) =>
        s +
        m.primitives.reduce(
          (sum, p) => sum + doc.accessors[p.indices].count / 3,
          0,
        ),
      0,
    );
    if (triangles !== lod.triangles || triangles > previous)
      throw Error("LOD triangle mismatch " + lod.path);
    previous = triangles;
    modelBytes += bytes.length;
    files++;
  }
  if (asset.lods.length !== 3) throw Error("Missing LOD " + asset.id);
}
if (expected.size) throw Error("Missing architecture " + [...expected]);
const summary = {
  ok: true,
  originals: requests.assets.length,
  sharedPaints: ids.size,
  models: models.assets.length,
  lodFiles: files,
  modelBytes,
  paintBytes: art.assets.reduce((s, a) => s + a.runtime.bytes, 0),
  visualAcceptance: "not established by integrity checks",
};
console.log(JSON.stringify(summary));
