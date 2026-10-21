import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

export const states = ["concept", "candidate", "integrated", "accepted"];
export const digest = (buffer) =>
  createHash("sha256").update(buffer).digest("hex");

export function localPath(root, relative) {
  if (
    typeof relative !== "string" ||
    !relative ||
    path.isAbsolute(relative) ||
    relative.includes("\\")
  ) {
    throw new Error(`Expected a repository-relative asset path: ${relative}`);
  }
  const resolved = path.resolve(root, relative);
  const rel = path.relative(path.resolve(root), resolved);
  if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(`Asset path leaves repository: ${relative}`);
  }
  return resolved;
}

export function validateManifest(manifest) {
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets))
    throw new Error("Invalid art manifest");
  const ids = new Set();
  for (const asset of manifest.assets) {
    if (!/^[A-Z][A-Z0-9_-]+$/.test(asset.id) || ids.has(asset.id))
      throw new Error(`Duplicate or invalid id: ${asset.id}`);
    ids.add(asset.id);
    if (!states.includes(asset.status))
      throw new Error(`Invalid state: ${asset.id}`);
    if (!["concept", "texture"].includes(asset.kind))
      throw new Error(`Invalid kind: ${asset.id}`);
    if (asset.kind === "concept" && asset.runtime !== null)
      throw new Error(`Concept cannot be a runtime texture: ${asset.id}`);
    if (
      asset.kind === "texture" &&
      ["integrated", "accepted"].includes(asset.status) &&
      !asset.runtime
    ) {
      throw new Error(
        `Integrated texture requires a runtime file: ${asset.id}`,
      );
    }
    if (
      asset.status === "accepted" &&
      (!asset.visualReview?.evidence?.length ||
        asset.visualReview.verdict !== "pass")
    ) {
      throw new Error(`Acceptance requires visual evidence: ${asset.id}`);
    }
    if (
      asset.method !== "image_gen" ||
      !asset.promptFile ||
      !/^[a-f0-9]{64}$/.test(asset.promptSha256) ||
      !asset.original ||
      !asset.references?.length
    ) {
      throw new Error(`Missing image-generation provenance: ${asset.id}`);
    }
    if (
      !asset.metadata ||
      !Number.isInteger(asset.metadata.width) ||
      asset.metadata.width < 1 ||
      !Number.isInteger(asset.metadata.height) ||
      asset.metadata.height < 1 ||
      !/^[a-f0-9]{64}$/.test(asset.metadata.sha256)
    )
      throw new Error(`Missing actual metadata: ${asset.id}`);
  }
  return manifest;
}

async function confinedFile(root, relative) {
  const candidate = localPath(root, relative);
  const real = await fs.realpath(candidate);
  const rootReal = await fs.realpath(root);
  const rel = path.relative(rootReal, real);
  if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel))
    throw new Error(`Asset symlink leaves repository: ${relative}`);
  return real;
}

export async function imageMetadata(file) {
  const buffer = await fs.readFile(file);
  const metadata = await sharp(buffer).metadata();
  const result = {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    hasAlpha: !!metadata.hasAlpha,
    bytes: buffer.length,
    sha256: digest(buffer),
  };
  if (metadata.hasAlpha) {
    const { data } = await sharp(buffer)
      .extractChannel("alpha")
      .raw()
      .toBuffer({ resolveWithObject: true });
    let min = 255,
      max = 0;
    for (const value of data) {
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    result.alphaRange = [min, max];
  }
  return result;
}

export async function verifyArt(root, manifest) {
  validateManifest(manifest);
  for (const asset of manifest.assets) {
    const original = await confinedFile(root, asset.original);
    const actual = await imageMetadata(original);
    for (const key of [
      "width",
      "height",
      "format",
      "hasAlpha",
      "bytes",
      "sha256",
    ]) {
      if (actual[key] !== asset.metadata[key])
        throw new Error(`${asset.id}: ${key} differs from recorded original`);
    }
    if (
      asset.transparent &&
      (!actual.hasAlpha ||
        actual.alphaRange[0] !== 0 ||
        actual.alphaRange[1] !== 255)
    ) {
      throw new Error(`${asset.id}: transparent asset needs effective alpha`);
    }
    const prompt = await fs.readFile(
      await confinedFile(root, asset.promptFile),
      "utf8",
    );
    if (!prompt.trim()) throw new Error(`${asset.id}: empty prompt`);
    if (digest(Buffer.from(prompt)) !== asset.promptSha256)
      throw new Error(`${asset.id}: recorded prompt changed`);
    if (asset.status === "accepted")
      for (const evidence of asset.visualReview.evidence)
        await confinedFile(root, evidence);
    for (const reference of asset.references) {
      const file = await confinedFile(root, reference.path);
      if (digest(await fs.readFile(file)) !== reference.sha256)
        throw new Error(`${asset.id}: reference changed: ${reference.path}`);
    }
    if (asset.runtime) {
      if (!asset.runtime.startsWith("public/assets/renovation/"))
        throw new Error(
          `${asset.id}: runtime must be in public/assets/renovation`,
        );
      await confinedFile(root, asset.runtime);
    }
    for (const variant of asset.runtimeVariants ?? []) {
      if (!variant.path.startsWith("public/assets/renovation/"))
        throw new Error(`${asset.id}: invalid runtime variant path`);
      const actual = await imageMetadata(
        await confinedFile(root, variant.path),
      );
      if (actual.sha256 !== variant.sha256)
        throw new Error(
          `${asset.id}: runtime variant changed: ${variant.path}`,
        );
    }
    if (asset.preview) {
      const metadata = await imageMetadata(
        await confinedFile(root, asset.preview.path),
      );
      if (
        metadata.sha256 !== asset.preview.sha256 ||
        metadata.width > actual.width ||
        metadata.height > actual.height
      ) {
        throw new Error(`${asset.id}: invalid or upscaled review derivative`);
      }
    }
  }
  return {
    count: manifest.assets.length,
    runtimeTextures: manifest.assets.filter((a) => a.runtime).length,
  };
}

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export async function prepareArt(root, manifest) {
  await verifyArt(root, manifest);
  for (const asset of manifest.assets) {
    const preview = `art/renovation/previews/${asset.id}.webp`;
    await fs.mkdir(path.dirname(localPath(root, preview)), { recursive: true });
    await sharp(localPath(root, asset.original))
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 90 })
      .toFile(localPath(root, preview));
    asset.preview = {
      path: preview,
      ...(await imageMetadata(localPath(root, preview))),
    };
  }
  const relative = (file) => path.posix.relative("art/renovation", file);
  const cards = manifest.assets
    .map(
      (asset) =>
        `<article id="${escapeHtml(asset.id)}"><div class="caption"><h2>${escapeHtml(asset.name)}</h2><span>${escapeHtml(asset.status)} · ${asset.userApproval?.status === "approved" ? "方向已选定" : "待审阅"}</span></div><a href="${escapeHtml(relative(asset.original))}"><img src="${escapeHtml(relative(asset.preview.path))}" width="${asset.preview.width}" height="${asset.preview.height}" alt="${escapeHtml(asset.name)}：美术概念图，非运行截图" loading="lazy"></a><p>${escapeHtml(asset.notes)}</p><p class="meta">原图 ${asset.metadata.width} × ${asset.metadata.height} · <a href="${escapeHtml(relative(asset.original))}">查看原图</a> · <a href="${escapeHtml(relative(asset.promptFile))}">生成提示词</a></p></article>`,
    )
    .join("\n");
  const reference = manifest.reference;
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>纸上浦江 · 美术方向审阅</title><style>body{margin:0;background:#f8f6f0;color:#263d48;font:17px/1.75 system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:48px 24px}header{max-width:950px;margin-bottom:40px}h1{font-size:clamp(28px,4vw,46px);font-weight:550;line-height:1.25}h2{margin:0;font-size:22px;font-weight:600}a{color:#235d78;text-underline-offset:4px}a:focus-visible{outline:3px solid #a3572d;outline-offset:5px}nav{display:flex;gap:12px;flex-wrap:wrap}nav a{padding:8px 12px;border:1px solid #bbc9c7;border-radius:4px}article{margin:40px 0 64px;scroll-margin-top:24px}img{display:block;width:100%;height:auto;background:#e7e9e3;border-radius:3px}.caption{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:12px;flex-wrap:wrap}.caption span,.meta{font-size:14px;color:#526260}p{max-width:1000px}.notice{border-left:3px solid #a3572d;padding:12px 20px;background:#eee9db}.reference{max-width:1000px}footer{border-top:1px solid #bbc9c7;padding-top:24px;font-size:14px}</style><main><header><p>纸上浦江 / ART DIRECTION</p><h1>美术方向审阅</h1><p class="notice">这里展示 image 工具生成的概念图，不是三维运行截图。A 已由用户选定；衍生色稿仍需审阅。概念图不会作为整幅背景替代实时三维。</p><nav>${manifest.assets.map((a) => `<a href="#${escapeHtml(a.id)}">${escapeHtml(a.name)}</a>`).join("")}</nav><p>模型与局部样片通过后才扩展全城。查看 <a href="../../docs/ART_RENOVATION_PROGRESS.md">实施进度</a>。</p></header><details class="reference"><summary>展开用户提供的图2参考</summary><img src="${escapeHtml(relative(reference.path))}" alt="用户提供的上海水彩城市风景参考" loading="lazy"><p>仅用于美术方向参考，未接入运行场景。</p></details>${cards}<footer>来源：OpenAI 内置 image_gen。原图未覆盖，预览仅缩小压缩。尺寸和校验值见 <a href="manifest.json">资源清单</a>；视觉验收独立于文件校验。</footer></main></html>`;
  await fs.writeFile(localPath(root, "art/renovation/review.html"), html);
  return manifest;
}
