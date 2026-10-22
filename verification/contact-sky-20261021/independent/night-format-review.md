# 夜 / 雨夜 RGB 天空：只读根因审查

冻结源码：`13b9f5372034cd6ba3e14144433792c525989f63`。父 agent 后续确认生产也已采用此包；初始“生产仍 e95”假设已更正。这里未核实部署，仅定位该包本身。

## 结论：图 2 night cube 的 RGBA 数据被按 RGB 上传

`src/world.js:550–557`：六个 `DataTexture` 的数据是 **RGBA**，每像素四字节，alpha 恒为 255；但外层 `CubeTexture` 漏设 `format`。旁边 daySky（:544）和 coast sky（`src/coast-map.js:1121`）均显式设置了 `THREE.RGBAFormat`。

原生 Three r128 验证（不是 hand-written Three stub）：

- 加载现成 `/tmp/roadster-three.min.js`，版本 `128`，SHA-256 `9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2`，与项目冻结的 browser bundle identity 一致。
- `new THREE.CubeTexture().format === THREE.RGBFormat === 1022`。
- 真实 night factory 返回 cube.format 1022，但六面 face.format 都是 RGBA 1023。
- 每面 128 × 128 × 4 = 65536 字节，按 RGB 只读取 49152 字节。128 × 3 = 384 正好符合 unpackAlignment 4，无行 padding 纠正此错误。
- +X 首 16 字节：`[7,9,26,255, 7,9,26,255, 7,9,26,255, 7,9,26,255]`。
- 正常 RGBA 得到连续暗蓝 `[7,9,26]`；实际 RGB 三字节分组得到 `[7,9,26]`、`[255,7,9]`、`[26,255,7]`、`[9,26,255]`。**红、绿、蓝恰是每像素 alpha 被错当颜色。**
- 六面均有 75% 上传像素含一个错误的 255 通道。原定像素 R/G/B 最大值均远小于 255。mipmap/线性采样会混色；本审查不把 byte 可视化称为 GPU 最终画面。

官方 r128 源码直接支持这条因果链：[CubeTexture 默认 RGB](https://raw.githubusercontent.com/mrdoob/three.js/r128/src/textures/CubeTexture.js) 行 9；[cube 上传代码](https://raw.githubusercontent.com/mrdoob/three.js/r128/src/renderers/webgl/WebGLTextures.js) 行 692、740 使用父 cube.format，而非 face.format。

### 最小修复

仅在 night cube 创建后补：

```js
cityNightSky.format = THREE.RGBAFormat;
```

不改夜空颜色、雾密度、renderer exposure、光源强度、不改变三张地图美术。由父 agent 唯一 writer 实施并回归。

## 背景与反射必须区分

通过冻结源码真实 `selectWeatherMode`、`applyCoastWeather`，配合原生 Scene、Color、FogExp2、CubeTexture / DataTexture，在 CPU 中逐一执行 3 图 × 4 天气：

| 地图 | 夜背景 | 雨夜背景 | 夜 / 雨夜 environment |
|---|---|---|---|
| 图 1 highway | Color `#070b16` | Color `#040812` | studioEnvMap；仅反射，不是背景 |
| 图 2 city | **nightCube，错误 RGB format** | **同一个缓存 nightCube** | studioEnvMap；夜 cube 只给 background |
| 图 3 coast | Color `#0d1c29` | Color `#101e29` | coastSky，正确 RGBA；仅反射，不是背景 |

图 2 日间 dayCube 是 RGBA；日间背景和 environment 同时用 dayCube。黄昏使用纯色背景 + Mars 反射环境。图 3 的 procedural sky 渐层并不直接作为 scene.background 显示。不能把车身 / 路面反光、雾或天空混为一谈。

主 renderer 未设置 toneMapping / exposure / outputEncoding，原生默认是 NoToneMapping、exposure 1、LinearEncoding。`src/start-screen.js:60` 的 sRGBEncoding 设置的是局部预览 renderer，不是游戏 renderer。没有 HDR 文件或 RGBE 载入链；studio 所谓“High-Dynamic”只是 canvas 颜色与白条纹，不是 HDR 格式解码。

## 方向与生命周期

六面顺序 +X / -X / +Y / -Y / +Z / -Z，生成方向公式与 cube 面约定一致；上方面 +Y、下方面 -Y。原生 CubeTexture `_needsFlipEnvMap=true` 对世界 X 作约定变换，因此展示方向表明确标注原生 X 翻转。这能镜像云层方向，但不可能制造 RGB 通道 255；不能误把方向翻转当色彩根因。

执行真实 `switchMap` / `restoreSceneState` 及天气函数：city 夜 → coast 夜 → highway 夜；city 日 → coast 日 → city 雨夜 → highway 雨夜 → coast 雨夜 → city 夜。按预期恢复 Color / cube、fog、environment、雨线与黄昏太阳可见性；未见 nightCube 泄漏到图 1 或图 3。这里海岸 enter 是最小原生对象 owner，以避免构建整个区块；restore/weather/switchMap 原函数执行。其它 UI、物理重置、traffic 与材质 callback 为无副作用 stub，边界已写 JSON。

## 证据文件

- `audit.cjs`：只读 `git show <冻结commit>:...`，执行实际函数与原生 Three 数据对象；不依赖工作树后续变化。
- `audit.json`：Three identity、12 个 scene 状态、天气转换、六面字节格式 / 样本 / 统计。
- `map-transition-audit.json`：上述九次地图 / 天气组合转换。
- `coast-pixel-audit.json`：海岸真实 weather 函数四天气 × 六面的 RGB 范围与中心样本；外层 / face 格式一致为 RGBA。
- `direction-samples.json`：世界方向 → 面 / 坐标 / intended RGB / RGB 错读数值。
- `night-six-faces-stored-vs-upload.png`：上排**真实存储 RGBA 的 RGB 通道**；下排**同一字节按 parent RGB upload 解释**。这是实际字节图，不是 GPU 截图、不是真机试玩图。

未修改仓库、未运行 repo check/build/test、未部署、未启用用户设备、未调用付费 API；未复制外部视觉资产。PNG 从该包程序真实生成的像素数据可视化产生。
