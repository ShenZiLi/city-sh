# 制作说明

## 美术制作

先生成白天全景 C01，再以其为参考编辑生成黄昏 C02、夜晚 C03，锁定水彩与不透明水粉、冷压纸纹、蓝青玻璃、奶油色石材和玫瑰红东方明珠。

T01—T11 为独立生成的材质与构件图集。S01—S03 为三时段天空色稿。D01、D02 采用 image 工具的透明背景生成，原图已验证存在 0—255 的透明通道。所有原图保持不变；运行贴图经过缩放、WebP 压缩，透明图保留 PNG。

生成提示词与实际尺寸记录在 art/manifest.json。生成尺寸由工具决定，因此实际原图包括 1536×1024、1254×1254 与 1774×887；这些尺寸均被保留。

## 模型与布局

全局坐标中，X 正方向为浦东，Z 负方向为北。底座约 116×86 个场景单位。布局为艺术化压缩，地标高度保持视觉层级。

- 上海中心：逐层旋转收分的自定义 BufferGeometry，并附带竖向幕墙线。
- 环球金融中心：带梯形孔洞的 Shape 与 ExtrudeGeometry，保留真实侧壁。
- 金茂：八角柱层叠退台、檐口与尖顶。
- 东方明珠：三根斜撑、球体、连接柱、塔针与灯环。
- 外滩：连续窗格、柱式、檐口、钟楼、穹顶、铜绿屋顶。
- 配景：固定随机种子生成 97 栋楼；相同材质的静态部件合并，树木与窗格实例化。

黄浦江岸线使用曲线函数采样。西岸堤岸在苏州河口断开，外白渡桥只跨苏州河。布局函数、地标排水面、固定随机序列及河口开口均有自动测试。

## 渲染与交互

日夜共用几何与贴图。唯一时段状态驱动 0—2 的连续过渡值；被新选择打断时从可见状态继续过渡。天空、雾色、日光、环境光、窗灯、石材暖光、水色、倒影和界面同步变化。

高档江面采用平面反射叠加水粉纹理和波纹；夜景启用克制的 Bloom。截图与实时画面共用渲染路径。所有动画使用时间增量，后台恢复时限制大时间跳跃。

鼠标射线先检测不透明楼体，因此普通楼群能够遮挡标签和阻止穿透选择。预设镜头与地标聚焦采用可被拖动中断的平滑相机过渡。镜头设置俯仰、缩放边界，避免钻入底座。

资源失败时报告具体编号并显示基础材质；WebGL 连接丢失时提示，恢复后由 Three.js 重建 GPU 状态。释放场景时清理相机、观察器、事件、UI 计时器、后处理和纹理。

## 资料

- 上海市政府：东方明珠及陆家嘴位置说明 https://english.shanghai.gov.cn/en-ScenicSpots/20231205/19a5f5184eca45728fd57a4d4c8efc61.html
- 上海市政府：外滩历史街区与苏州河桥梁 https://english.shanghai.gov.cn/en-HeritageZones/20231208/f2ac293f546a4d32aba936f2e733a47c.html
- Three.js OrbitControls https://threejs.org/docs/pages/OrbitControls.html
- Three.js MeshToonMaterial https://threejs.org/docs/pages/MeshToonMaterial.html
- Vite 静态交付 https://vite.dev/guide/static-deploy.html
- 页面使用自身的三时段配色，并采用 Dark Reader 官方页面级声明保护创作色彩：https://github.com/darkreader/darkreader/blob/main/CONTRIBUTING.md#disabling-dark-reader-on-your-site

照片资料仅用于了解建筑关系，未作为运行贴图打包；全部美术原图由 image 工具生成。
