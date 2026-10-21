import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { findBlender } from "./art-toolchain.mjs";
const blender = findBlender();
if (!blender)
  throw new Error(
    "Blender is required. Run npm run art:doctor; no procedural runtime fallback is permitted.",
  );
execFileSync(
  blender.executable,
  [
    "--background",
    "--factory-startup",
    "--python",
    fileURLToPath(
      new URL(
        process.argv.includes("--v2")
          ? "blender/build_city_assets_v2.py"
          : "blender/build_sample_assets.py",
        import.meta.url,
      ),
    ),
  ],
  {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    stdio: "inherit",
    timeout: 300000,
  },
);
