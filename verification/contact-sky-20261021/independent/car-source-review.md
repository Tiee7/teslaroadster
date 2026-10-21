# 用户车模截图：只读审查

输入：`reference.png`（已直接查看真实像素，2048 × 1239）。图中是非常近的外部前侧视角，中央顶棚 / 部分侧窗看起来缺失、可以看到内饰；背景仍是之前已定位的 RGB 夜空错误。**单张截图不包含 cameraMode / near / altitude / zoom / FPV 标记，不能据此断言车模被改坏，也不能断言 near 裁剪就是此截图根因。**

## 1. PR18 没有修改车模资产

对 e95abcc → 13b9f53：`vehicles.js`、`reference-exterior.js`、`reference-cockpit.js`、`reference-traffic.js`、`npc-traffic-assets.js`、`highway-traffic.js` 源码 hash 全同。physics-main 的 camera / visibility / near / orbit 区逐字未变；该文件变化在 collision 与 diagnostics。

在真实 Three r128 中分别从四个冻结 commit 的 git blob 建立模型（没有运行页面 / WebGL），使用每个 commit 的 **真实 world.js 共享材质构造块**，比较每个 mesh 的 position / index / normal 等全部 BufferAttributes、material 数值 / flags、object transform / scale / matrixWorld、visibility：

- e95abcc 与 13b9f53 都是 628 mesh，完整 canonical JSON SHA 同为 `ae9139e19332e3f4ec055dfb9d5b1c5cabf6b8d1cdf7e07028991994130755a4`。
- `reference-exterior.js` 与较早批准 f16643e 完全相同，源码 SHA `3d99d3652f09b4b4a0fabb589674b70bb0cafde81ac0d6d4906128ea01a8c782`。
- f16643e 与 13b9f53 的 **196 个既有同名 mesh 全部逐字段相同**，无既有同名 mesh 消失。新同名项目是 `fading-cold-gas-envelope`；总 mesh 数不同来自未命名喷流部分，不能把它说成全场景始终完全相同。
- cf3e772 比 f16643e 早，reference exterior SHA 不同，是已知后续 tail revision；不能把 cf3e772 当成与已批准 f16643e 相同的 geometry。
- 当前参考顶棚材质是 opaque MeshPhysicalMaterial：opacity 1、transparent false、FrontSide、depthWrite true；不是突然被改成透明材质。
- 这里加载是程序生成 native BufferGeometry，无外部 model URL / 解码器 / 加载尺度。模型加载文件在 PR18 不变。

原生库：`/tmp/roadster-three.min.js`，REVISION 128，SHA `9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2`。

## 2. 独立确认一个旧 camera bug：高 altitude + 近距离 showroom 与 near 冲突

现有 `src/physics-main.js` 的第三人称 near：`clamp(.38 + altitude*.045, .38, 3.2)`；showroom radius=`3.65 * camZoom`，高度=`.85+.95*camZoom`，lookAtY=.56。此组合已在 f16643e 存在，不是 PR18 新改。

用原生 PerspectiveCamera、Matrix4、Frustum 与**真实参考顶棚 mesh 的每一个顶点 / index triangle**验证，固定可复算示例：zoom .75、orbit -π/4、车身姿态 0，camera position 相对车 `[1.9357048,1.5625,-1.9357048]`，距 target **2.9152894 m**。顶棚实际 view depth 范围 **1.7509662–4.1241708 m**，总 4992 三角形。

| altitude | near | 完全被 near 裁掉的顶棚三角形 | 横跨 near 的三角形 | target 在 frustum 内 |
|---|---:|---:|---:|---|
| 0 m | .38 | 0 | 0 | 是 |
| 20 m | 1.28 | 0 | 0 | 是 |
| 40 m | 2.18 | 338 | 53 | 是 |
| 60 m | 3.08 | 2778 | 56 | 否 |
| 80 / 380 m | 3.2 | 3077 | 54 | 否 |

这证明：**即使车辆 mesh.visible=true、资产完全完整，旧高空 close-orbit camera 也能裁掉大块顶棚与车身。** 原生 Frustum 结果而非经验猜测。

但在地面 / 同角度默认 zoom 样例中，near .38 完全不会裁顶棚。因此未经用户高度 / camera 参数佐证，**不可把这个已证实缺陷自动等同于截图根因**。截图看似近地街道，需保留这种反证边界。

## 3. FPV / normal / winding 只读核验

- 两轮 `setCockpitPerspective(true) → false` 与 `setCockpitExteriorDetailsVisible(...)`：参考 canopy group 在 true 隐藏、false 恢复；geometry position SHA 始终 `eabc247b0408d6e9c4e8e5181fa757fb0d2e7328a34b33444444c009498fa95d`。
- 用原生 Raycaster 从上述 ground camera 向中央玻璃六个 station 发射射线，FrontSide canopy 均可命中，说明该姿态下不是顶棚 winding 反向导致整片 backface 丢失。
- 这不证明用户当前 session 没有异常 visibility 状态；只证明冻结源码中的正常切换不自发损坏几何，常规 ground pose 没有这个 winding 故障。

## 4. 最小候选，未实施

1. **先获取只读诊断证据**：用户同一视角的 cameraMode、camZoom、camera.near、altitude / AGL、camera world transform 与 `reference-canopy.visible`，再决定截图链。
2. 若与高空 near 冲突一致，候选仅限 camera clipping policy（例如 showroom 使用近距离专用 near，或按到实际可见车身的最近 view depth 约束 near），**不改模型 geometry / material / scale / loader，也不以 DoubleSide / 透明度变更掩盖问题**。
3. 对 ground close-orbit 若参数也正常，则需要 GPU / runtime state 证据，不能靠改资产猜修。

未实现任何候选，未改仓库、未改资产、未运行 repo check/build/test、未部署、未启动用户设备。原生 CPU 数学不是 GPU 截图或真机复现。

## 文件

- `readonly-audit.cjs`：可重复审查脚本（仅读 git blobs；native Three）。
- `readonly-audit.json`：四提交 source / mesh identity，FPV toggles，120 个 camera 参数 sweep。
- `meshes-*.json`：native geometry / normals / index / material / transform 数据 hash。
- `named-mesh-identity.json`：f16643e → 13b9f53 的 196 个既有同名 mesh 完全相同。
- `canopy-frontside-ray-audit.json`：六个 station native FrontSide 射线交点。
