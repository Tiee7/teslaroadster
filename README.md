# 2026 Tesla Roadster SpaceX Package — Flight & Highway Simulator
# 2026 特斯拉 Roadster SpaceX 冷气推进版飞行与公路物理模拟器

---

## 📦 项目交付物概述 (Deliverables Overview)

本压缩包包含 **2026 特斯拉 Roadster SpaceX 火箭版高保真 3D 模拟器** 的全部交付成果，兼具即开即玩的单文件独立部署版本与高内聚低耦合的模块化源码工程：

```
tesla_roadster_simulator_package/
├── index.html                      # 独立单文件版本（已内嵌项目CSS与JS；第三方库和字体仍需联网加载）
├── README.md                       # 完整的技术文档、操作指南、物理参数与版本更新说明
├── bundle_app.py                   # 模块化代码一键打包脚本（将 src/ 重新编译为单文件 index.html）
└── src/                            # 模块化源码工程
    ├── index.html                  # 模块化 HTML 骨架与 UI DOM 结构
    ├── styles.css                  # 赛博拟物毛玻璃、暗黑科技感与极简 HUD 样式
    ├── config.js                   # 双语国际化词条 (I18N)、车辆/天气/视角预设、物理常量与全局状态
    ├── audio.js                    # Web Audio API 多层实时音效合成器与座舱智能语音播报引擎
    ├── world.js                    # Three.js 场景渲染、动态光影、6车道高架高速与 2400m 开放都市
    ├── vehicles.js                 # 1:1 官方精修 Roadster 样条曲面网格、F1战机座舱、车流超跑模型
    ├── ui-hud.js                   # 全键盘/触控输入响应、仪表盘动效、车漆/地图切换与极简HUD逻辑
    └── physics-main.js             # 6-DOF 空中飞行动力学、触地防坠毁保护、真实自由落体与18G解体损毁
```

---

## 🚀 核心系统与四大维度重构 (Core Engineering Dimensions)

### 1. 3D 模型高保真复刻 (3D Model Fidelity)
- **1:1 官方样条放样曲面 (Spline Lofting)**：基于 2026 McGregor 实车演示细节，严格采用 20 组截面 Catmull-Rom 放样算法，重塑隆起轮拱、侧向负压进气道、C 柱飞扶壁与后扰流扩散器。
- **5 晶体矩阵 LED 大灯与贯穿式尾灯**：内嵌 5 组独立投射晶体、反光碗与赛博蓝日行灯眉，车尾配备贯穿式深红 LED 尾灯与高位刹车灯 (CHMSL)。
- **F1 战机级座舱与交互 HUD**：全景深色防眩镀金座舱盖、碳纤维包覆内饰、带换挡提示灯的 3D 转向 Yoke 舵盘（支持随转向角与空中滚转实时转动）、中心 17 寸触控屏动态仪表。
- **10 个 SpaceX 超音速冷气推进喷口**：包含 4 个尾部主推喷口（带 De Laval 喷管、中心柱塞与实时双轴云台推力矢量偏转）、4 个车底垂直升力喷口、2 个车身侧向姿态喷口与前鼻锥反推喷口，配备普朗特-格劳厄脱超音速激波锥与马赫环折射光效。

### 2. 物理引擎真实化与动力学重构 (Physics Engine Rationalization)
- **常规物理 vs 幻想模式双轨动力学**：
  - *常规物理模式 (Realistic)*：地面遵循 0-100 km/h 1.9s 实测电驱特性，极速 200 km/h；按下 `;` 键或开启狂暴模式 (Plaid) 解锁 370 km/h 超音速音障（38 m/s² 强悍推力）。空中限速并受空气动力阻力与重力影响。
  - *幻想极速模式 (Fantasy)*：超频推力上限达 576+ km/h，全功率无限制高空自由翱翔。
- **真实 10 秒 600L COPV 气瓶压力衰减**：
  - `0.0s ~ 8.0s`：全功率冷气推力爆发。
  - `第 8.0 秒 (剩余 20% / 2.0s)`：气压跌落至浮空阈值以下，强制触发自动下降 (Auto-Descent)。
  - `第 10.0 秒 (0% 耗尽)`：推进器彻底断气，车辆立即进入重力自由落体。
- **真实自由落体下坠力学 (重构修复)**：将断气自由落体下坠加速度提升至物理标准的 $24.5\,\text{m/s}^2$（与横向场景光流渲染倍率严格对齐），终端下坠速度可达 $-65.0\,\text{m/s}$（约 $234\,\text{km/h}$），赋予断气瞬间真实的下坠初速度。
- **连续 360° 俯仰与延迟自动回正**：空中长按 I/K 或上下键可连续向前、向后翻滚；触控也有独立 Pitch/Roll 按钮。玩家进行姿态操作时不介入回正，松开所有姿态控制满 2 秒后平滑回正；再次操作会重新计时。采用最短等效角度回正，避免翻越 180° 或完成一圈后反向绕圈；近地仍保留触地姿态保护。
- **手刹动量守恒漂移 (U 键)**：拉起手刹切断后轮横向抓地力，车辆沿航向角与滑移角平滑甩尾，松开手刹瞬时将总速度无缝导回前进动力，彻底根除减速死停。
- **触地防坠毁自动制动 (Hoverslam Save)**：近地高速坠落时在极限刹车高度自动喷气点火减速并回正姿态，防止坠毁。
- **18G 致命碰撞解体物理**：实时计算相对碰撞速度 $\Delta v$、冲击过载与形变动能，单次撞击 $\ge 18.0\,\text{G}$（$\Delta v \ge 100\,\text{km/h}$）或车体耐久归零直接粉碎性解体。

### 3. UI 界面人性化与交互增强 (UI Humanization)
- **三档 HUD**：`Z` 或顶部 HUD 按钮依次切换完整 → 中等 → 极简，并在本浏览器保存选择。中等保留左右面板、相机入口与手机触控驾驶按钮，收起装饰、其余功能菜单与底部提示；极简进一步收起两侧面板与触控按钮。两档精简模式均保留车外速度/气量仪表、接客方向与必要通知。FPV 仅使用车内实时仪表，不重复悬浮速度/气量。
- **清晰车内气量条**：实体仪表屏移入固定座舱视场，气量横槽与文字分离，带 20% 警戒线；车内外共用实时剩余量，满瓶、持续喷气、耗尽和重置一致。移除挡视线的车内中央后视镜与支架。
- **中英双语极速切换 (🌐)**：全局 DOM 元素、弹窗指南、实时警报与语音朗读均支持一键热切换。
- **12 款官方精调航天质感车漆**：航天阳极白 (Ano White)、主打多涂层红、暗夜钛黑、星舰液态亮银、赛博电光蓝等。
- **3 大动态天气与光照系统**：星际暗夜 (Cyber Night)、赛博霓虹雨夜 (Neon Rain，含柔和细腻的湿沥青反光、挡风玻璃水滴与雷暴雷鸣)、火星落日黄昏 (Mars Sunset)。
- **3 级镜头缩放与 4 种相机视角**：追视视角 (Chase)、3D 展厅特写 (V)、高空俯瞰 (Orbit)、沉浸式第一人称战机座舱 (FPV C)。

### 4. 缺陷修复与稳健性保障 (Bug Fixes & System Polish)
- **彻底消除地面深度 Z-Fighting**：动态依据海拔高度按对数曲线调节近裁剪面 `camera.near`，多层路面材质严格配置 `polygonOffset`。
- **输入防粘滞与失焦保护**：窗口失焦或切换后台时自动清除所有按键锁定，杜绝油门或气瓶持续误喷。
- **精准 200% 耗气量的 6m 快速跳跃 (O 键)**：按单次跳跃真实时长按比例扣除相当于普通爬升 2.0 倍的气量。

---

## 🎮 完整操作指南 (Controls Reference)

| 按键 / 操作 | 功能描述 | 模式与效果 |
| :--- | :--- | :--- |
| **W** | 电驱加速 / 空中喷气 | 地面纯电驱动；空中自动调用冷气喷气推进并耗气 |
| **; (分号)** | SpaceX 尾部火箭喷射 | 无论地面或空中均启动 4 喷口 80kN 极限火箭推进加速 |
| **A / D** | 转向 / 空中车头偏航 (Yaw) | 地面阿克曼转向；空中控制机头水平转向 |
| **H** | 脚刹制动 (Foot Brake) | 普通制动；超过 200 km/h 平滑联动共享气瓶逆喷，240 km/h 满功率；触发刹车灯与活动尾翼气动减速 |
| **S** | 倒车 / 反推制动 (Reverse) | 地面后退（亮倒车灯）；超过 200 km/h 辅助制动；空中按实际运动方向联动逆喷减速 |
| **U** | 手刹动量漂移 (Handbrake) | 切断后轮侧向摩擦，动力滑移过弯，松开立即恢复前进 |
| **SPACE** | 垂直爬升 (Climb & Hover) | 点火 4 个底部升力喷口加速升空 (+30% 动力) |
| **SHIFT** | 喷气主动下降 (Descend) | 点火顶部姿态喷口强制下压快速降落 |
| **O** | 6米战术喷气跳跃 (6m Jump) | 2.5倍速垂直弹射至6米高空，耗气量为普通爬升的200% |
| **N** | 空中定高悬浮 (Altitude Hold) | 锁定当前离地高度，以 0.22x 超微量冷气持续维持高度 |
| **Q / E** | 空中横向平移 (Lateral Strafe)| 空中车身向左/向右纯平移机动 |
| **J / L (或 ← / →)** | 空中横滚 (Roll) | 控制车身向左/向右翻滚（长按可做 360° 桶滚特技） |
| **I / K (或 ↑ / ↓)** | 空中俯仰 (Pitch) | 长按可连续向前 / 向后 360° 翻滚 |
| **Y** | 狂暴 Plaid 模式开关 | 解锁 370 km/h 极速与火箭弹射动力 |
| **B** | 速度单位切换 | KM/h (公里/小时) ⇄ MPH (英里/小时) |
| **Z** | HUD 界面模式切换 | 完整 → 中等（保留两侧）→ 极简；自动记住选择 |
| **F** | 物理模式切换 | 常规物理模式 (Realistic) ⇄ 幻想极速模式 (Fantasy) |
| **C** | 第一人称座舱视角 (FPV) | 进入超清战机级座舱（实时仪表屏、Yoke转动、HUD十字线） |
| **V** | 3D 展厅特写视角 (Showroom) | 镜头环绕欣赏 1:1 车身工业细节 |
| **T** | 天气与时间切换 | 暗夜 ⇄ 赛博霓虹雨夜 ⇄ 火星落日黄昏 |
| **M** | 切换世界地图 | 高架高速 (Elevated Highway) ⇄ 赛博都市 (Mega Cyber City) |
| **X** | RCS 自动回正开关 | 开启时在松开姿态控制满 2 秒后平滑回正 |
| **R** | 修复并重置车辆 | 重置车辆姿态、补满空气槽与完整修复受损车身 |
| **[ / ] 或 滚轮** | 镜头远近调节 | 紧凑近景 (75%) / 标准追视 (100%) / 广角远景 (125%) |

---

## 🛠️ 如何运行与开发 (How to Run & Develop)

### 方案 A：直接运行（用户/体验端）
- 无需安装构建依赖，但需要联网加载 Tailwind CSS、Three.js 和 Google Fonts。
- 使用支持 WebGL 的现代浏览器打开根目录下的 `index.html`。也可在工程根目录执行 `python3 -m http.server 8000`，然后访问 `http://localhost:8000/`。
- `src/index.html` 是模块化开发入口，根目录 `index.html` 是打包后的入口。

### 方案 B：模块化源码开发与二次编译
1. 进入工程根目录，源码位于 `src/` 文件夹下。
2. 自由修改 `src/vehicles.js`（车辆建模）、`src/physics-main.js`（物理引擎）、`src/config.js`（参数与I18N）或 `src/styles.css`。
3. 执行打包脚本重新生成单文件交付物：
   ```bash
   python3 bundle_app.py
   ```
4. 运行基础语法检查（JavaScript 检查需要 Node.js）：
   ```bash
   python3 -m py_compile bundle_app.py
   for file in src/*.js; do node --check "$file" || exit 1; done
   ```
5. 用浏览器打开 `http://localhost:8000/`，检查模拟器加载、控制与界面。以上语法检查不代替浏览器运行验证。

---
*Generated for 2026 Tesla Roadster SpaceX Thruster Flight & Highway Simulation Deliverable Suite.*

## Persistent leaderboard v1 / 持久排行榜

新增自愿参加的 60 秒积分挑战，按地图与物理模式分为四个榜单，每个匿名浏览器身份仅保留各榜最高成绩，公开前 100 名。昵称和成绩会公开，请使用化名。排行榜需要 Vercel Node.js API 和已配置的 Upstash Redis；直接打开单文件仍可进行沙盒模拟，但不能使用在线排行榜。服务端会过滤并验证昵称、请求结构、范围、身份、单次挑战编号、时间及频率，之后才写入榜单。浏览器端游戏无法完全防作弊。

See [deployment, API, security, privacy and testing details](docs/leaderboard.md). No production credentials are included. Development checks: `python3 bundle_app.py`, `npm test`, `npm run check`, `npm run build`. `npm run dev` serves the bundled game locally and returns a clear unavailable response until server-only leaderboard environment values are configured.

## Looping background music / 循环背景音乐

The user-provided `assets/Ludicrous_Velocity_bgm.mp3` is served unchanged (178.584 seconds, stereo MP3, 24 kHz / 64 kbps). A single player starts on the first permitted tap/key interaction and loops across vehicle resets, map changes, and game modes. Open **Settings → Pause music / Resume music** (also available from the initial map-selection screen). Pause preserves the playback position; the enabled/paused preference is remembered in this browser. Position itself is not restored after a page reload. Vehicle SFX uses the separate top-bar SFX control. Music temporarily pauses while the page is hidden and resumes when visible if enabled, subject to browser autoplay restrictions. If playback is blocked, Settings provides a retry. Settings initializes before the WebGL world.

`npm run build` copies the MP3 into `public/assets/`; serve the site over HTTP rather than copying only index.html. `npm run dev` supports audio GET, HEAD, and byte-range requests. Run `npm test`, `python3 tests/lua_runtime.py`, `npm run check`, and `npm run build` for local regression checks.

## Vercel Web Analytics / 网站访问分析

The game uses Vercel's [official plain-HTML integration](https://vercel.com/docs/analytics/quickstart): a `window.va` queue and a deferred first-party `/_vercel/insights/script.js` script in `src/index.html`, carried into the standalone bundle and production build. This is a static HTML/JavaScript app, so the Next.js-only `@vercel/analytics/next` component and a framework migration are unnecessary. Analytics initializes independently of WebGL, leaderboard requests, and background music. No custom events, nicknames, scores, or player identity tokens are sent by game code.

Enable **Web Analytics** for the `teslaroadster` project in the Vercel dashboard, then deploy (or redeploy) so Vercel serves its analytics routes. Do not enable a paid upgrade without approval. After a normal production page visit, verify that `/_vercel/insights/script.js` loads successfully and the browser sends its automatic page-view request. Analytics is hosted by Vercel and is unavailable when opening the standalone file directly or using the local development server; its absence must not stop the game. No analytics credentials or extra npm dependencies are required.

## Cockpit tank and passenger bearing / 车内气量与载客方向

Cockpit tank seconds, liters, fill and gas mass now use the current remaining-air value, including a true 0.0 kg when empty. The external gas-mass telemetry is also refreshed from the same frame's tank value. The cockpit mass readout sits below the tank, clear of the flight instruments and passenger status strip.

While a passenger is on board, an upper-left arrow points directly toward the green destination relative to the car's heading: up means ahead, right means the car's right. It updates in every camera/HUD mode and disappears on delivery, passenger loss, reset or map exit. Only the arrow is visible: the title, distance text and background frame are removed; a screen-reader label retains the direction context and distance. Its own layout row keeps it above the side controls on desktop and small screens. It is a bearing indicator, not a turn-by-turn road route.

Regression checks cover full/partial/empty/recharging tanks, same-frame cockpit/external readings, cardinal and arbitrary vehicle headings, full-turn angle boundaries and passenger lifecycle cleanup. The available cloud environment cannot validate real WebGL gameplay or visual appearance.

### HUD、座舱与撞毁积分更新

HUD 的中等档保留两侧面板、相机入口、语言/设置/排行榜入口以及手机触控驾驶按钮；按钮或 Z 循环三档并保存选择。精简档不隐藏载客目的地方向或关键通知。

车内仪表重排为速度、清晰横向剩余气量槽（20% 警戒线、秒数、升数、质量）及接客信息。实体屏和转向舵盘位置微调，适配竖屏宽度，防止仪表被视场边缘、仪表台或转动舵盘遮挡。移除中央后视镜及支架；外部侧镜保持原状。

撞毁弹窗显示与右侧遥测一致的驾驶总分；已开启城市接客时另显示扣分后的独立接客积分，保留排行榜状态。弹窗在小屏可滚动，修复/换地图按钮可达。

## High-speed retro braking / 高速逆喷制动

H foot braking automatically adds cold-gas retro thrust above 200 km/h on both maps. The demand feathers smoothly from zero at 200 to full thrust at 240 km/h, and tapers back to normal braking below the threshold. S also shares this high-speed assist while keeping its reverse-drive function; airborne H/S retain the existing low-speed manual retro control. Keyboard and touch buttons use the same controls. The established W/semicolon throttle priority remains: release the accelerator to engage H/S braking. U continues to be the momentum-preserving handbrake.

The added force is limited to the package's 80 kN divided by current vehicle-plus-gas mass, approximately 40–43 m/s². Full retro demand uses 0.55 tank-seconds per second (33 L/s); feathered demand and the last available gas fraction scale the impulse and tank debit together. H+S requests a single retro burn. The impulse opposes actual world-space travel, including backward/vertical flight, and clamps at zero instead of accelerating through it. Exhaust selection follows the full 3D vehicle heading. Ground, roof and helipad refill pauses while retro jets fire. The flow display measures actual combined tank debits, and tank seconds/liters/mass remain shared across cockpit and HUD modes.

Air brakes now retain passive aerodynamic drag, fixing the earlier behavior where H/S removed that drag and could slow less effectively than simply releasing the throttle. An empty tank still allows mechanical ground braking and passive air drag; retro depletion itself no longer adds an artificial downward velocity kick. S brakes an already-fast reverse landing progressively instead of instantly snapping its velocity to the reverse cruise limit. Foot brake plus handbrake retains ordinary braking below the retro threshold.

The bottom-right city passenger score is a single live number, retaining the existing passenger-score calculation. The destination indicator sits in the safe top-left corner, with live remaining meters below its rotating arrow and no title or background frame. The white-beam pickup radius is 4 m (doubled from 2 m); the green destination radius remains 2 m, and grounded-only arrival validation is unchanged. Driver score, destination-bearing calculation, cockpit passenger status and scoring rules are unchanged.

Regression coverage includes the 200/240 boundaries and both HUD speed units, supersonic speeds, 30/60/144 Hz threshold fade, full/partial/empty tanks, combined-jet accounting, refill exclusion on ground/roofs/helipads, forward/reverse/vertical/flipped travel, throttle/brake/handbrake combinations, touch release/cancel, and passenger-score lifecycle changes. The tests execute production movement, altitude, attitude, input and score code in deterministic frame harnesses. The available cloud environment cannot initialize WebGL, so these checks do not constitute real-browser gameplay or visual validation.

## Clear forward cockpit view / 座舱前路视野

FPV now uses a higher fixed driver eye and hides the opaque A-pillar rails in that view. The cowling and steering wheel move below the driving sightline. The tall center screen becomes a short, camera-aligned instrument pod at the bottom edge: speed and units, live tank seconds/liters/mass, the 20% warning bar, and the passenger strip remain. The face is capped at 156 CSS pixels high, 20% of viewport height and 68% of viewport width; the surrounding bezel stays below the upper 76% road-view region. Leaving FPV restores the original exterior/showroom transforms and rails. Field of view stays at 60 degrees and cockpit shake remains disabled.

Regression checks execute the production resize/visibility code and generated body triangle mesh across desktop, phone portrait and short landscape dimensions. They check road sight rays, complete readouts against the body/cowling/fully turned steering wheel, bottom-edge bounds, repeated perspective changes and portrait/landscape resizing. Geometry and layout tests do not substitute for real WebGL gameplay validation.
