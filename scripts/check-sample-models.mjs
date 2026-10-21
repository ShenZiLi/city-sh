import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { digest, localPath } from "./art-assets.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(
  await fs.readFile(
    path.join(root, "public/assets/renovation/models/manifest.json"),
    "utf8",
  ),
);
const expected = new Set(["pearl", "customs", "hsbc", "heritage", "modern"]);
let bytes = 0,
  files = 0;
for (const asset of manifest.assets) {
  if (!expected.delete(asset.id))
    throw new Error(`Unexpected or duplicated sample model: ${asset.id}`);
  const source = await fs.readFile(localPath(root, asset.source));
  const signature =
    source.subarray(0, 7).toString() === "BLENDER" ||
    source.readUInt32LE(0) === 0xfd2fb528 ||
    source.readUInt16LE(0) === 0x8b1f;
  if (
    !signature ||
    source.length !== asset.sourceBytes ||
    digest(source) !== asset.sourceSha256
  )
    throw new Error(`Blender source differs from recorded export: ${asset.id}`);
  if (
    asset.lods.length !== 3 ||
    new Set(asset.lods.map((l) => l.level)).size !== 3
  )
    throw new Error(`Missing LODs: ${asset.id}`);
  let previous = Infinity;
  for (const lod of [...asset.lods].sort((a, b) => a.level - b.level)) {
    const data = await fs.readFile(localPath(root, `public/${lod.path}`));
    if (
      data.readUInt32LE(0) !== 0x46546c67 ||
      data.readUInt32LE(4) !== 2 ||
      data.readUInt32LE(8) !== data.length
    )
      throw new Error(`Invalid GLB header: ${lod.path}`);
    if (data.readUInt32LE(16) !== 0x4e4f534a)
      throw new Error(`Missing GLB JSON chunk: ${lod.path}`);
    if (data.length !== lod.bytes || digest(data) !== lod.sha256)
      throw new Error(`Model differs from recorded export: ${lod.path}`);
    const document = JSON.parse(
      data.subarray(20, 20 + data.readUInt32LE(12)).toString(),
    );
    if (
      !document.nodes?.some((n) => n.name === "label-anchor") ||
      !document.nodes.some((n) => n.name === "focus-anchor")
    )
      throw new Error(`Missing anchors: ${lod.path}`);
    if (
      !document.images?.length ||
      document.images.some((i) => i.uri || i.bufferView === undefined)
    )
      throw new Error(`Texture images must be embedded in GLB: ${lod.path}`);
    let triangles = 0;
    for (const mesh of document.meshes)
      for (const primitive of mesh.primitives) {
        if ((primitive.mode ?? 4) !== 4)
          throw new Error(`Unexpected non-triangle primitive: ${lod.path}`);
        triangles +=
          document.accessors[primitive.indices ?? primitive.attributes.POSITION]
            .count / 3;
      }
    if (triangles !== lod.triangles || triangles > previous)
      throw new Error(`LOD complexity mismatch: ${lod.path}`);
    previous = triangles;
    bytes += data.length;
    files++;
  }
}
if (expected.size) throw new Error(`Missing sample models: ${[...expected]}`);
console.log(
  JSON.stringify({
    ok: true,
    models: manifest.assets.length,
    lodFiles: files,
    bytes,
    visualAcceptance: "separate; not implied by GLB validation",
  }),
);
