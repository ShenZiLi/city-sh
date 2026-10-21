import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export function findBlender() {
  const candidates = [
    process.env.BLENDER_BIN,
    "/Applications/Blender.app/Contents/MacOS/Blender",
    "blender",
  ].filter(Boolean);
  for (const executable of candidates) {
    try {
      const version = execFileSync(executable, ["--background", "--version"], {
        encoding: "utf8",
        timeout: 20000,
      }).split("\n")[0];
      if (version.startsWith("Blender ")) return { executable, version };
    } catch {
      /* Check the next known location; missing Blender is reported below. */
    }
  }
  return null;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const blender = findBlender();
  const report = {
    checkedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    blender,
    ready: !!blender,
    missing: blender
      ? []
      : [
          "Blender: install the application or set BLENDER_BIN to its executable",
        ],
    fallbackPolicy:
      "Missing Blender never authorizes replacing promised GLB assets with procedural blocks.",
  };
  const root = fileURLToPath(new URL("..", import.meta.url));
  await fs.mkdir(path.join(root, "output/art-renovation"), { recursive: true });
  await fs.writeFile(
    path.join(root, "output/art-renovation/toolchain.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
  if (!blender) process.exitCode = 1;
}
