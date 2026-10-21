import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { localPath, validateManifest, verifyArt } from "./art-assets.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(
  await fs.readFile(path.join(root, "art/renovation/manifest.json"), "utf8"),
);
const clone = () => structuredClone(manifest);

test("current originals, provenance and review derivatives match their recorded files", async () => {
  const result = await verifyArt(root, manifest);
  assert.ok(result.count >= 10);
  assert.equal(result.runtimeTextures, 4);
});
test("asset references cannot escape the repository", () => {
  for (const relative of [
    "../outside.png",
    "/outside.png",
    "art/../../../outside.png",
    "..\\outside.png",
  ]) {
    assert.throws(() => localPath(root, relative));
  }
});
test("a concept cannot silently become a runtime image", () => {
  const m = clone();
  m.assets[0].runtime = "public/assets/renovation/background.webp";
  assert.throws(() => validateManifest(m), /Concept cannot/);
});
test("duplicate asset ids fail validation", () => {
  const m = clone();
  m.assets.push(structuredClone(m.assets[0]));
  assert.throws(() => validateManifest(m), /Duplicate/);
});
test("loading or selecting a concept does not constitute visual acceptance", () => {
  const m = clone();
  m.assets[0].status = "accepted";
  assert.throws(() => validateManifest(m), /visual evidence/);
});
test("recording larger dimensions cannot pass as additional image detail", async () => {
  const m = clone();
  m.assets[0].metadata.width *= 2;
  await assert.rejects(verifyArt(root, m), /width differs/);
});
test("reference substitutions are detected by the recorded hash", async () => {
  const m = clone();
  m.assets[0].references[0].sha256 = "0".repeat(64);
  await assert.rejects(verifyArt(root, m), /reference changed/);
});
test("opaque originals cannot be declared transparent", async () => {
  const m = clone();
  m.assets[0].transparent = true;
  await assert.rejects(verifyArt(root, m), /effective alpha/);
});
test("symlinks cannot bypass the repository boundary", async () => {
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), "huangpu-art-test-"),
  );
  try {
    const outside = path.join(temporary, "outside");
    const inside = path.join(temporary, "inside");
    await fs.mkdir(outside);
    await fs.mkdir(inside);
    await fs.writeFile(path.join(outside, "image.png"), "not-an-image");
    await fs.symlink(outside, path.join(inside, "escape"));
    const m = clone();
    m.assets[0].original = "escape/image.png";
    await assert.rejects(verifyArt(inside, m), /symlink leaves/);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
