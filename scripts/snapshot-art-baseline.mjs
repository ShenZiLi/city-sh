import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("..", import.meta.url));
const destination = path.join(root, "output/art-renovation/baseline");
const marker = path.join(destination, "baseline.json");
try {
  await fs.access(marker);
  throw new Error(
    "Baseline already exists; refusing to overwrite historical evidence.",
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
await fs.mkdir(destination, { recursive: true });
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const files = [];
for (const name of [
  "screenshots",
  "benchmark.json",
  "functional-report.json",
  "reliability-report.json",
  "review.html",
]) {
  const source = path.join(root, "output", name);
  try {
    await fs.cp(source, path.join(destination, "historical", name), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
    files.push(`historical/${name}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
const archive = execFileSync("git", ["archive", "--format=tar.gz", "HEAD"], {
  cwd: root,
  maxBuffer: 200 * 1024 * 1024,
});
await fs.writeFile(path.join(destination, "source.tar.gz"), archive, {
  flag: "wx",
});
const report = {
  capturedAt: new Date().toISOString(),
  sourceCommit: commit,
  archive: {
    path: "source.tar.gz",
    sha256: createHash("sha256").update(archive).digest("hex"),
  },
  historicalEvidence: files,
  historicalEvidenceNotice:
    "Copied from the original delivery. Not current device measurements.",
  freshEvidence:
    "fresh/ — new baseline screenshots on this machine; see fresh/report.json",
  reproduction:
    "Extract source.tar.gz, run npm ci, then npm run dev. The archive contains original tracked assets.",
};
await fs.writeFile(marker, JSON.stringify(report, null, 2) + "\n", {
  flag: "wx",
});
console.log(
  JSON.stringify({
    ok: true,
    commit,
    historicalItems: files.length,
    destination,
  }),
);
