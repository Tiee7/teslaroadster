# 地图 2：官方游戏参考与原创程序建筑方案（只读研究）

研究时间：2026-10-21 UTC。源仓库：`/workspace/scratch/cb38b7731a0f/teslaroadster_map2_scale_20261021`。本研究不修改仓库；唯一 writer 为父任务。没有运行 check、test runner、build、bundle 或部署。

## 先说建议

**推荐把 99 栋提升到 227 栋，而不是继续堆同一种塔楼。** 保留原 99 栋、35 个高楼补气标记、原 2 座桥及位置；64 个街区各新增 2 栋 14–26 m 的中段低楼，形成 `192 低楼 + 35 高楼`。相比原数量增加约 129%。每街区仍留一条边的中段空口，视觉上形成广场/后场的节奏。

不要填建筑到路口。道路保持 24 m、双向 6 条真实 4 m 车道；米制与 `CITY_WORLD_SPEED_SCALE=1.0` 不变。新楼放到街区四条边的**中点槽位**，不是四角。

用 6 种原创立面语言替代“所有楼都是同色盒子 + 同款水平发光带”：暖砖商住、浅砂岩、灰混凝土办公、冷灰玻璃、竖向深窗酒店、公寓/轻工业。优先用共享几何、实例颜色和自绘窗格纹理；不要每窗一个 mesh，不加 PointLight/SpotLight。

## 实际浏览的 primary 来源与边界

本次实际使用 web 浏览以下**官方网页、截图页、官方图片 URL**。记录依据为网页正文、页面图像标签与官方图链接；没有声称完成完整高分辨率逐像素视觉审查，没有把第三方画面纳入项目或发布。

### 1. Cities: Skylines II — Paradox 官方

- 官方游戏页（含 Gameplay Screenshots、City 与 CityFrogAngle 图片链接）：
  <https://www.paradoxinteractive.com/games/cities-skylines-ii/about>
- 官方 Press 页，明确提供 screenshots：
  <https://www.paradoxinteractive.com/games/cities-skylines-ii/press>
- 从官方游戏页实际打开的 City 图 URL：
  <https://images.ctfassets.net/u73tyf0fa8v1/3bOH6aXszmkOKVWbD0AUDT/cfd6cb770684b4aa4d58fa35969c2f15/cities-skylines-ii-City.webp?fm=webp&q=75&w=1920>
- 从同页实际打开的低视角 CityFrogAngle 图 URL：
  <https://images.ctfassets.net/u73tyf0fa8v1/93JNJkM5xiq7EPs2JxkxH/eec378b3f9363701db0e220b4b94e137/cities-skylines-ii-CityFrogAngle.webp?fm=webp&q=75&w=1920>

**原创转译（设计判断，不是对其实现的事实断言）**：学习城市“街道低层基座—中层体量—少数地标”的层次，而不是复制模型。让新增建筑建立连续的中段街墙，塔楼仍在街区深处。各区采用一致的 2–3 个主材色，不做随机彩色散点。

### 2. Forza Horizon 5 — Microsoft / Turn 10 官方

- 官方摄影指南：
  <https://forza.net/news/forza-photo-guide>
  - `DAYTIME` 段直接讨论 Guanajuato 的彩色建筑及建筑投影；有官方示例截图。
- 官方世界介绍：
  <https://forza.net/news/forza-horizon-5-road-to-mexico-june-update>
  - 介绍 Guanajuato、曲折街道与地下水道；首图 alt 是 buggy 群在墨西哥教堂前。
- 从世界介绍实际打开的官方图链接（仅浏览 URL，未保存资产）：
  <https://cdn.forza.net/strapi-uploads/assets/large_Forza_Horizon5_09_16x9_WM_Buggy_Meetup_5b05816a6d.jpg>

**原创转译（设计判断）**：借鉴材色分区与厚实开窗阴影，让路侧低楼具有暖灰、砂岩、铁锈红与浅蓝灰的有限色盘。用共享的深色窗洞/浅色窗套区分建筑，不照搬墨西哥地标、道路布置、招牌或纹理。其曲折道路不适用于本任务，应保留现有米制直线网格与路口视野。

### 3. GTA V — Rockstar 官方（仅补充；没有读到图，不作为已看图的证据）

- <https://www.rockstargames.com/gta-v>
- <https://www.rockstargames.com/newswire/article/25o2411812ak13/new-grand-theft-auto-v-pc-screens>

两个页面实际尝试 web open，但返回正文为空；本研究不据此声称看过 Rockstar 的街景截图，也不以此支持具体视觉结论。前两款官方游戏已提供本研究所需的两个有效参考。

## 可落地的 6 套原创样式

所有新参数均为本任务原创；不是官方游戏资产的复刻尺寸。

| 样式 | 适用 | 简洁几何/材质语言 | 原创参数建议 |
|---|---|---|---|
| 暖砖商住 | 新低楼 | 深基座、细竖向窗套、小比例深窗格；屋顶保持水平 | H 14/18 m；砖色 `#8c6556`、窗深色 `#28323a`；roughness 0.78–0.88 |
| 浅砂岩街楼 | 新低楼 | 宽窗套与明暗分层，弱化自发光 | H 18/22 m；`#b8aa90`、`#8c8f86`；roughness 0.72–0.84 |
| 混凝土办公 | 新低楼或原高楼 | 交替的宽窄立面跨距，水平深窗，不新增灯 | H 22/26 m 或沿用高楼 H；`#919ba1`；roughness 0.6–0.75 |
| 冷灰玻璃 | 原高楼 | 自绘 2D 网格纹、宽竖向分缝；不透明/低透明材质优先 | 原 76–120/180 m；`#536b79`；metalness 0.25–0.4、roughness 0.24–0.38 |
| 竖向酒店 | 原高楼 | 深浅纵条与错位开灯窗，避免全楼同一横亮带 | 原 H 不变；`#737a84`、深窗 `#25333d`；少量暖窗 |
| 板式公寓/轻工业 | 新低楼 | 宽而平的体量、深灰底层、少数整齐服务门；轮廓保持平顶 | H 14/18/22 m；`#9a9f99` / `#6f777b`；roughness 0.75–0.9 |

窗格建议自绘 canvas/data atlas 或共享 unit-quad 图案，不使用外部贴图。窗亮度用原有环境/材质及很弱发光（例如 emissiveIntensity 0.06–0.16）；不能把此建议当作已验证的曝光值。日/夜要同步变化，不改变原雨天路面材质逻辑。

### 轮廓变化与碰撞安全

源码 `src/physics-main.js` 以 `cityBuildings` 的二维 AABB 与单一 `height` 计算墙碰撞、屋顶落地及补气；`src/world.js` 当前每栋主体是与定义一致的 BoxGeometry。

因此首阶段应先做**真实体量的宽/深/高差异 + 材质/窗套节奏差异**，保持平屋顶与现有包围盒合同。不要仅把视觉塔楼改成退台/尖顶/锯齿屋顶却仍用原整栋 AABB，否则会在上部空气中撞墙或悬空落地。

若后续需要真正 podium + 退台：须把碰撞/屋顶支持改为分层几何并验证每层屋面，且把建筑 identity 与碰撞 shape 分开，保持 helipad 计数仍为 35；这超出本次只读候选验证。此处不是要求 writer 扩大开发范围。

## 候选几何参数

街区中心保持 `[-1050,-750,-450,-150,150,450,750,1050]²`。现有道路间距 300 m，路宽 24 m。

四个中段槽位相对街区中心为 `(111,0), (-111,0), (0,111), (0,-111)` m。法向进深固定 30 m，沿街宽 36/42/48 m：

`150 - 12(半路宽) - 12(退距) - 15(半进深) = 111` m。

推荐 227 栋：

1. 原楼位置全部保留。
2. 每街区补原低楼的对面槽位。
3. 再补一条垂直边槽位；按 iz 奇偶交替正/负边。
4. 新低楼高在 `[14,18,22,26]` m 中确定性选择，样式用 `(district+ix+2*iz+slotNo)%6`；不使用 Math.random 造成不可重现布局。
5. 第四条边留空，避免四边全封、保留远处塔楼与街区内部的窥视口。

备选 291 栋是四边槽位全填，CPU 几何也通过，但不优先：画面更密，留白更少，对阴影/纹理与手机视角的风险更高，仍须实际浏览器/GPU验收后才决定。

## CPU 证据与性能建议

复现实验：`node /workspace/shared/tesla-next-city-reference-audit/geometry-audit.mjs`。它只在 VM 中加载本地 Three r128 和原构建函数，候选仅生成 metadata，不改源文件、不创建构建产物。

| 检查 | 原 99 栋 | 推荐 227 栋 | 密集 291 栋 |
|---|---:|---:|---:|
| 低楼 | 64 | 192 | 256 |
| helipad=true | 35 | 35 | 35 |
| 原 bridgePair | -1050/-750 | 保留 | 保留 |
| 全 6 lane / 49 路口、42336 条视线阻挡 | 0 | 0 | 0 |
| 越界 / 压道路 / 楼间重叠 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| 40 m 路口视线三角违规 | 0 | 0 | 0 |
| 新低楼最小路边退距 | — | 12 m | 12 m |

原场景 CPU 统计：758 meshes、721 个唯一 geometry、53 材质、99 shadow casters、0 场景内新增 lights；把 paint InstancedMesh 的实例三角形展开后约 45,000 triangles。**这些不是实际 GPU draw-call 采样或 FPS 结论。**

性能落点：

- 新低楼主体使用 unit box + InstancedMesh + instanceColor，6 样式最多约 6 主体批次；窗带/门面/窗套以共享几何合批，而不是复制 128 套独立材料和 geometry。
- 若将原装饰一起合批，35 个 helipad 材料与 H 标记也可共享；但不应趁机改动补气身份、桥位与物理。
- 新 low 的窗格、装饰不 castShadow；新增主体是否 castShadow 应按真实浏览器帧时间决定，不在 CPU 报告里声称已达到性能指标。
- 建议 writer 最终验收：真实相机默认竖屏/横屏；昼/夜/雨；49 路口各 approach；35 pad 落地补气和两桥；新增楼碰撞/屋顶；renderer.info 的 calls/triangles、帧时间。本文不替代这些集成验收。

## 下载拒绝记录（不能绕过）

- action：尝试用 Python urllib 读取 Forza 官方公开图并保存为 `/workspace/shared/tesla-next-city-forza-ref.jpg`，仅供本地观察。
- target：`https://cdn.forza.net/strapi-uploads/assets/large_Forza_Horizon5_09_16x9_WM_Buggy_Meetup_5b05816a6d.jpg`。
- result：**DENIED / auto-review**，理由为截图许可未核实，持久化保存超出只读浏览授权并与不复制未许可资产的要求冲突。
- disposition：该命令未成功；没有重试、换路径或换工具保存该图；后续仅继续官方网页正文/图标签/链接研究。未把任何第三方图片/纹理/模型写入 repo，未发布任何第三方资产。此报告与 JSON 只有来源 URL、源码只读统计和原创参数。

## 文件

- `geometry-audit.mjs`：原创只读 CPU 审核脚本。
- `geometry-results.json`：审核结果。
- `recommended227-building-defs.json`：原 99 + 原创候选 128 的 metadata；不是已实施代码或渲染资产。

