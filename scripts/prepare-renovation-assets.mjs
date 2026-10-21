import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareArt, verifyArt } from "./art-assets.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifestFile = path.join(root, "art/renovation/manifest.json");
try {
  const manifest = JSON.parse(await fs.readFile(manifestFile, "utf8"));
  if (!process.argv.includes("--check")) {
    await prepareArt(root, manifest);
    await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
  }
  console.log(
    JSON.stringify({
      ok: true,
      ...(await verifyArt(root, manifest)),
      visualAcceptance:
        "separate user review; never inferred from successful validation",
    }),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
