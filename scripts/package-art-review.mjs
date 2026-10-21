import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { localPath } from "./art-assets.mjs";
const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(
  await fs.readFile(path.join(root, "art/renovation/manifest.json"), "utf8"),
);
const files = new Set([
  "art/renovation/review.html",
  "art/renovation/manifest.json",
  manifest.reference.path,
  "docs/ART_RENOVATION_PLAN.md",
  "docs/ART_RENOVATION_PROGRESS.md",
  "docs/ART_RENOVATION_HANDOFF.md",
]);
async function addTree(relative) {
  try {
    for (const entry of await fs.readdir(localPath(root, relative), {
      withFileTypes: true,
    })) {
      if (entry.name === "models") continue;
      const child = relative + "/" + entry.name;
      if (entry.isDirectory()) await addTree(child);
      else if (entry.isFile()) files.add(child);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
await addTree("art/renovation/v2");
await addTree("output/art-renovation/v2");
for (const asset of manifest.assets) {
  files.add(asset.original);
  files.add(asset.promptFile);
  if (asset.preview) files.add(asset.preview.path);
}
for (const optional of [
  "output/art-renovation/review.html",
  "output/art-renovation/sample-functional.json",
  "output/art-renovation/extra-checks.json",
  "output/art-renovation/resource-budget.json",
  "output/art-renovation/VISUAL_REVIEW.md",
]) {
  try {
    await fs.access(localPath(root, optional));
    files.add(optional);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
try {
  for (const file of await fs.readdir(
    path.join(root, "output/art-renovation/sample"),
  )) {
    if (file.endsWith(".png"))
      files.add(`output/art-renovation/sample/${file}`);
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
for (const file of files) {
  const destination = localPath(path.join(root, "dist"), file);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(localPath(root, file), destination);
}
console.log(
  `Packaged ${files.size} local art-review files; no external image URLs.`,
);
