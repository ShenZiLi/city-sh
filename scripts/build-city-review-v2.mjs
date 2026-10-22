import fs from "node:fs/promises";
const art = JSON.parse(
  await fs.readFile("art/renovation/v2/manifest.json", "utf8"),
);
const capture = JSON.parse(
  await fs.readFile("output/art-renovation/v2/captures.json", "utf8"),
);
const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const style =
  "<style>body{margin:40px auto;padding:0 24px;max-width:1500px;background:#f7f3e9;color:#263b42;font:15px/1.7 system-ui}h1,h2{font-family:serif}a{color:#315f70}img{max-width:100%;display:block}figure{margin:0;background:#fffdf5;padding:12px;border:1px solid #d5cbb6}figcaption{padding:10px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}.notice{padding:16px;background:#eae2ce}code{overflow-wrap:anywhere}</style>";
const assetCards = art.assets
  .map(
    (a) =>
      `<figure><a href="../../../${a.original}"><img loading="lazy" src="../../../${a.original}" alt="${esc(a.name ?? a.id)}"></a><figcaption><strong>${a.id} · ${esc(a.name ?? "原图裁切")}</strong><br>${a.originalMetadata ? `${a.originalMetadata.width}×${a.originalMetadata.height} · 内置 imagegen` : "从既有 imagegen 原图裁切"}<br>状态：${a.supersededBy ? `旧候选，当前由${a.supersededBy}替代` : '已接入，未视觉验收'}${a.promptFile ? `<br><a href="../../../${a.promptFile}">完整提示词与工具记录</a>` : ""}<br><code>${esc(a.runtime.path)}</code></figcaption></figure>`,
  )
  .join("");
await fs.writeFile(
  "art/renovation/v2/review.html",
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>纸上浦江 · V2 美术资源</title>${style}<h1>纸上浦江 · V2 美术资源</h1><p class="notice">${art.assets.filter((a) => a.method === "image_gen").length} 张内置 imagegen 原图，${art.assets.length} 项保留的共享素材，其中 ${art.assets.filter(a=>a.status==='integrated').length} 项当前接入。加载成功不代表美术通过。</p><p><a href="../../../art-lab.html">实时三维样片</a> · <a href="../../../output/art-renovation/v2/review.html">实际运行截图</a></p><div class="grid">${assetCards}</div>`,
);
const cards = (kind) =>
  capture.captures
    .filter((c) => c.kind === kind)
    .map(
      (c) =>
        `<figure><a href="captures/${c.name}.png"><img loading="lazy" src="captures/${c.name}.png" alt="${esc(c.name)}"></a><figcaption>${esc(c.name)} · ${c.state.drawingBuffer.width}×${c.state.drawingBuffer.height}<br>实际渲染链路原始 PNG，未经后期美化</figcaption></figure>`,
    )
    .join("");
await fs.writeFile(
  "output/art-renovation/v2/review.html",
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>纸上浦江 · V2 运行画面对照</title>${style}<h1>纸上浦江 · V2 运行画面对照</h1><p class="notice">待视觉验收。采集时间：${esc(capture.capturedAt ?? "未记录")}。下方均为最新生产样片实际输出；美术评分与用户确认单独记录，截图存在不代表视觉通过。</p><p><a href="../../../art-lab.html">查看最新实时版本</a> · <a href="../../../art-lab-v1.html">上一轮局部样片</a> · <a href="../../../art/renovation/v2/review.html">imagegen 原图与提示词</a></p><h2>A 色稿（方向参考）</h2><img src="../../../art/renovation/originals/RA01.png" alt="已选定 A 色稿，仅作为方向参考"><p><a href="VISUAL_REVIEW.md">本轮视觉评审与差距</a> · <a href="performance.json">独立性能采样</a> · <a href="budget.json">资源及显存估算</a></p><h2>本轮前后对照（同一默认预设，含镜头重标定）</h2><div class="grid"><figure><img loading="lazy" src="baseline-2026-10-22/day-main.png" alt="本轮修改前"><figcaption>2026-10-22 修改前</figcaption></figure><figure><img loading="lazy" src="captures/day-main.png" alt="本轮修改后"><figcaption>2026-10-22 修改后</figcaption></figure></div><h2>三时段主画面</h2><div class="grid">${cards("main")}</div><h2>24 方位实际运行画面</h2><div class="grid">${cards("orbit")}</div><h2>七处地标近景</h2><div class="grid">${cards("model")}</div>`,
);
console.log(
  "V2 asset gallery and runtime review pages saved; screenshot freshness explicitly recorded.",
);
