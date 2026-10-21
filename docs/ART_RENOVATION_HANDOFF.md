# 《纸上浦江》收尾与下次接续

记录日期：2026-10-21。用户要求本轮立即收尾、保存状态、提交本地 Git 并推送 GitHub。

## 接续入口

- 仓库：`/Users/shen/Studio/Code/city-sh`；远端：`https://github.com/ShenZiLi/city-sh`。
- 分支：`codex/browser-art-renovation-v2`。本次为阶段性保存，不是美术改造完成。
- 先读本文件，再读 `docs/ART_RENOVATION_PLAN.md` 末尾的范围修订及 `docs/ART_RENOVATION_PROGRESS.md`。
- 不要重新讨论引擎或重新选择风格：用户已决定纯浏览器、Three.js、保留360°与三时段、桌面画质优先、采用图2与 A 色稿，新增绘画素材必须实际使用内置 imagegen。

## 已落地

- 新完整样片：`/art-lab.html`，入口 `src/art-v2/main.ts`。旧主页 `/index.html` 未替换；V1 局部样片为 `/art-lab-v1.html`。
- 七处稳定 ID：`pearl`、`shanghai`、`swfc`、`jinmao`、`customs`、`hsbc`、`peace`。
- 十二类配景、两类船只和外白渡桥，共22个独立 Blender 源文件、66个三档 GLB。离线模型仍为逐栋定义的参数化制作，不能称为人工精雕或已达参考质量。
- 内置 imagegen 实际生成10张新增原图；加上既有原图裁切，共13项共享运行绘画素材。原图、提示词、工具返回路径、真实尺寸、Alpha与哈希在 `art/renovation/v2`。没有付费服务或第三方模型。
- 场景组织为布局、模型与共享材质、环境、光照、渲染和入口模块；统一河道与岸线、显式滨江街区、四种树冠、苏州河口、桥梁、船尾波、三时段与单独窗灯遮罩已接入。
- 保留 SceneControls 方法；已接入镜头、模型预览、选择与聚焦、标签、画质、细节切换、截图、减少动态效果和恢复释放。
- 原始运行截图34张：三时段主视图、24方位、七地标近景，在 `output/art-renovation/v2/captures`。`captures.json` 记录环境与状态。资源画册和对照页可由 `node scripts/build-city-review-v2.mjs` 重建。

## 验证与证据边界

- 收尾自动测试：18项 Vitest + 9项资源测试，共27项通过。
- 构建包含旧资源校验、V1 模型校验、V2 原图来源和66个 GLB 校验；最终结果另见当前提交前检查。
- `output/art-renovation/v2/regression.json`：12组生产浏览器回归通过；包括四镜头、快速切时段、原生鼠标选取、三档细节重复切换与稳定资源计数、画质、减少动态效果、横竖屏模拟、WebGL恢复、释放。
- 实测 Apple M5 / ANGLE Metal / Chromium 153；浏览器110%缩放，CSS 1745×982、绘制1919×1080。精细档稳定采样约59.9 FPS、P95约17.6ms；流畅档约59.9 FPS、P95约34.2ms，**未达到25ms目标**。截图循环中的暮夜P95受截图与切换影响，不当作稳定性能结论。
- 收尾最后变更：修正钟面正反、金茂八角轮廓、窄屏镜头距离和雾范围、渲染计数包装的恢复释放。已有全套截图及浏览器回归早于其中部分修改，**下一轮应对最终源码重新采集**。源代码和 GLB 哈希检查以最终构建为准。
- 视觉六维度尚未完成最终评分，用户未认可。本轮不得标记达到4.2门槛；剩余六地标与全城扩展未开始。

## 下次从这里执行

1. `git status`、`npm run art:v2:check`，确认当前分支与所有资产齐全；无需重新生成已保存的 imagegen 原图。
2. `npm run build`，以生产成品启动 `npm run preview -- --host 127.0.0.1 --port 4183 --strictPort`，先看最新主画面和海关钟面、金茂轮廓。已有服务可能不再运行，不要假定本机端口仍可用。
3. 用 Tabbit 技能运行 `scripts/qa-city-v2-captures.js`，保存返回的实际 artifact 路径，再按 `captures.json` 复制34张原始PNG回仓库；运行 `scripts/qa-city-v2-regression.js` 更新回归记录。脚本默认生产地址4183。CLI使用稳定启动器 `/Users/shen/.local/bin/tabbit-cli`；每次检查任务/页面归属，不假定旧 tab/group 仍存在。
4. 优先修正美术：主画面仍有大片平坦草地、街区间距与远景阵列感，天空笔触较扁平，水面倒影偏平滑且碎光不足，部分建筑结构与比例仍简化，夜景与精细笔触仍需打磨。对照 A 与实际截图逐项记录；继续修改当前七地标样片，不批量扩展。
5. 检查苏州河口、桥梁与各岸线的多角度关系、云朵Alpha及夜间可读性；完成六维视觉评分。仅真实运行画面达到门槛并获得用户认可后，制作剩余六处地标及切换主页。
6. 补齐最终资源/显存预算与流畅档长采样，报告实体手机未实测。源码中共享纹理已减少GLB重复，但完整预算报告尚未完成。

## 重建命令与注意

```sh
npm run art:v2:prepare
npm run art:v2:models
npm run art:v2:check
npm test
npm run build
node scripts/build-city-review-v2.mjs
```

- `art:v2:prepare` 仅裁切、压缩与生成 UV 遮罩，不调用 imagegen；`art:v2:models` 需要已安装的 Blender 5.2.2 LTS。
- Blender源文件有可优化的未使用数据累积，22个正式`.blend`合计约229MB；`.blend1/.blend2`已忽略。下一轮可先清理导出过程孤立数据再重建，切勿删除原图或伪造尺寸。
- 当前全部运行资源本地化，无CDN。报告/原图/截图与运行资源分开计算体积。
- 本地验证过程中使用了4182开发、4183生产端口，旧会话还曾有4174/4180服务；是否保留由实际进程状态决定。不要关闭用户其他应用或服务。
- AGENTS要求代码发现优先 codebase-memory MCP，shell命令加`rtk`。不要把概念图或测试通过当成最终美术验收。
