# 《纸上浦江》继续制作交接

更新：2026-10-22。分支 `codex/browser-art-renovation-v2`。本次为V2样片持续制作，**不是美术改造完成**。

## 已确定方向

纯浏览器、Vite/TypeScript/Three.js、本地静态交付；保留360°、三时段、十三处稳定地标ID及既有核心交互。采用图2与A色稿RA01；新增绘画素材实际使用内置imagegen。不要重新讨论游戏引擎或重新选风格。

当前仅七地标完整样片，P3视觉未通过、用户未认可。剩余 `ifc`、`aurora`、`mall`、`china`、`club`、`signal` 六处不得先行批量扩展。旧主页 `/index.html` 保留，V1为 `/art-lab-v1.html`。

## 运行与资产入口

- 最新样片 `/art-lab.html`，源码 `src/art-v2`，模块分为资产、布局、城市组装、环境、光照、渲染与入口。
- 七处：`pearl`、`shanghai`、`swfc`、`jinmao`、`customs`、`hsbc`、`peace`；十二类配景、两类船只及外白渡桥，共22个独立Blender源文件、66个GLB。
- 模型是逐栋定义的离线参数化Blender几何，不能称为人工精雕或已经达到参考质量。
- V2共12张实际内置imagegen原图、15项共享运行素材。2026-10-22新增V211玻璃与V212地表，各1254×1254；完整原图/提示词/工具路径/哈希在 `art/renovation/v2`。旧V203原图保留，当前玻璃使用V211，旧V203已标记被替代，当前实际接入14项绘画素材。
- 窗灯由UV遮罩控制；模型不内嵌重复贴图，运行材质统一缓存。完整来源在美术与模型清单，资源状态仍为候选/已接入。
- 美术原图画册 `art/renovation/v2/review.html`；运行对照 `output/art-renovation/v2/review.html`。

## 本轮已改

- 重排东方明珠和三塔，默认目标 `[0,30,-115]`、偏移 `[-170,126,382]`，40°视场；外滩街区收紧、外围城市闭合。
- 增加铺装前庭、口袋公园和树群；配景由530左右增至861实例。远景仍有阵列和裸地，不以数量视为完成。
- 现代楼体使用冷色细框，修正玻璃窗层UV；公寓有真实屋顶中庭，拱窗改为几何拱框与嵌入玻璃。
- 天空角度映射、低空云层、动态笔触与扰动倒影；排除大块云层镜面反射。最后修正夜间笔触过亮、降低窗灯与东方明珠发光，并补现代楼体暗部结构。
- 稳定时段复用建筑阴影，反射取消额外MSAA；来源文件清理孤立数据，Blender由约229MB降至89.5MB，GLB约9.0MB。
- 修复冷着色器卡顿拖长2.4秒过渡：过渡使用真实时间，镜头积分仍限幅；帧时间不再过滤可见的>500ms卡顿。

## 验证与证据

- 自动检查：18项Vitest + 9项资源测试，共27项通过；生产构建与66个GLB/原图哈希检查通过。
- `regression.json`：12组生产功能检查通过，含镜头、连续切时段、真实鼠标拾取、细节重复切换、减少动态效果、横竖屏模拟、上下文恢复与释放。已在最后夜景材质修正后的生产成品重跑。
- `missing-asset.json`：主动使海关GLB返回404，确认具体错误、无占位画布，取消故障后可重载。
- `captures.json`：34张实际渲染PNG，含三时段主画面、24环绕、七地标。记录采集时间和实际入口bundle。原图未经后期美化。
- `baseline-2026-10-22` 保留本轮修改前34图；`history-2026-10-21` 保留更早截图和回归。
- `budget.json`：首屏保守未压缩约17.7MB；全部运行资源约75.6MB；V2运行资源约16.2MB；精细/流畅纹理与渲染目标保守估算353/247MB。估算不是实测VRAM，包含绘制缓冲余量，不含几何与未知驱动分配。
- 本机Apple M5 / ANGLE Metal / Chromium153。浏览器110%缩放，CSS1745×982，绘制1919×1080；手机仅模拟视口，未测实体硬件。
- `performance.json` 与 `performance-background.json` 保留实际采样，不以测试通过推导性能达标。早一轮20秒样本精细中位57.8FPS/P95 150ms、流畅59.9FPS/P95 50.6ms，均未达P95目标。最后一组同样preserve策略的独立20秒采样：精细59.9FPS/P95 17.7ms、流畅59.9FPS/P95 17.6ms，达到该窗口目标。前面的失败样本仍保留，不能据此宣称长时间/全角度都已稳定。没有关闭用户其他应用来优化结果。
- Tabbit任务默认preserve；运行环境拒绝`page.bringToFront()`，其提示的`--foreground`参数在当前CLI也不被支持。未绕过此限制，不能把采样称为已完成前台隔离基准。
- 六维人工初评与具体差距见 `VISUAL_REVIEW.md`，仍未达4.2门槛。

## 下次从这里执行

1. 核对分支和工作区；读取最新 `captures.json` 的bundle与时间，再看白昼、夜景和反向图。
2. 重点解决实际视觉差距：远景规则阵列和裸地、街道与建筑裙房连接、天空水平融合区/接缝、树冠与立面笔触尺度、夜景窗灯组织。继续七地标样片，不扩大范围。
3. 性能仍需定位：保留失败样本，明确浏览器前后台与并行负载。当前主通道约180次，主通道约74万三角形；高档还有法线、反射等通道，不能只报告主通道。禁止静默降低精细档分辨率。
4. 以真实运行图复核六维评分；每项≥4且平均≥4.2并获得用户确认，才扩展剩余六地标和切换主页。

## 重建与验证

```sh
npm run art:v2:prepare
npm run art:v2:models
npm run art:v2:check
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 4183 --strictPort
node scripts/report-city-budget-v2.mjs
node scripts/build-city-review-v2.mjs
node scripts/package-art-review.mjs
```

- shell命令按AGENTS要求加`rtk`。代码发现优先codebase-memory MCP。
- Blender 5.2.2 LTS已安装。重建模型不会调用imagegen；不要重新生成已合格并保留的原图。
- 浏览器使用Tabbit技能及稳定CLI `/Users/shen/.local/bin/tabbit-cli`，先inventory/resume本任务组；不要假定旧进程、任务、端口或Tabbit artifact路径还有效。
- `scripts/qa-city-v2-{captures,regression,performance,missing-asset}.js` 仅在Tabbit浏览器所属Node运行；实际返回的artifact路径用于复制证据。
- 先等待构建完整结束再启动浏览器回归，构建时dist短暂为空会产生无效404。渲染截图不作为稳定性能测量窗口。
- 如需推送，已有GitHub远端。直连此前失败，macOS本机代理为127.0.0.1:7890，可仅对本次git命令传入http.proxy；不要改全局设置。
