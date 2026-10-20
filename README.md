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
- **共享冷气主推与姿态喷口**：4 个尾部主推口、4 个底部升力口、4 个顶部下降/姿态口、4 个侧向平移/偏航口和 2 个前部逆喷口。喷流沿各车型真实出口向外渐隐，不使用实心白锥或叠层蓝环。既有 230 MPH 游戏阈值只触发短暂凝结气流视觉提示，不能视作真实音速或流体仿真。

### 2. 物理引擎真实化与动力学重构 (Physics Engine Rationalization)
- **常规物理 vs 幻想模式双轨动力学**：
  - *常规物理模式 (Realistic)*：地面遵循 0-100 km/h 1.9s 实测电驱特性，电驱极速 200 km/h；按下 `;` 键或开启狂暴模式 (Plaid) 解锁 370 km/h 超音速音障（38 m/s² 强悍推力）。普通模式松开喷气后保留超过 200 km/h 的余速，按自然滑行阻力的 1.3 倍连续缓慢回落；O 跳跃先短暂保留原有横向惯性，再平滑恢复灵活的飞行操控；持续飞行时松开推进可快速减速，转向时航迹更快跟随机头。超出空中推进速度范围的余速连续回落，不瞬时截断。
  - *幻想极速模式 (Fantasy)*：超频推力上限达 576+ km/h，全功率无限制高空自由翱翔。
- **真实 10 秒 600L COPV 气瓶压力衰减**：
  - `0.0s ~ 8.0s`：全功率冷气推力爆发。
  - `第 8.0 秒 (剩余 20% / 2.0s)`：气压跌落至浮空阈值以下，强制触发自动下降 (Auto-Descent)。
  - `第 10.0 秒 (0% 耗尽)`：推进器彻底断气，车辆立即进入重力自由落体。
- **地球重力自由落体**：无升力喷气时按 $9.81\,\text{m/s}^2$ 计算垂直重力，保留松开喷气或耗尽气瓶瞬间的升降速度；不再注入下坠速度、不再套用横向光流倍率或人为终端速度。垂直位移使用解析积分，不随帧率变化。未引入未经测量的垂直空气阻力模型。
- **连续 360° 俯仰与延迟自动回正**：空中长按 I/K 或上下键可连续向前、向后翻滚；触控也有独立 Pitch/Roll 按钮。玩家进行姿态操作时不介入回正，松开所有姿态控制满 2 秒后平滑回正；再次操作会重新计时。采用最短等效角度回正，避免翻越 180° 或完成一圈后反向绕圈；近地仍保留触地姿态保护。
- **手刹动量守恒漂移 (U 键)**：拉起手刹切断后轮横向抓地力，车辆沿航向角与滑移角平滑甩尾，松开手刹瞬时将总速度无缝导回前进动力，彻底根除减速死停。
- **触地防坠毁自动制动 (Hoverslam Save)**：近地高速坠落时在极限刹车高度自动喷气点火减速并回正姿态，防止坠毁。
- **18G 致命碰撞解体物理**：实时计算相对碰撞速度 $\Delta v$、冲击过载与形变动能，单次撞击 $\ge 18.0\,\text{G}$（$\Delta v \ge 100\,\text{km/h}$）或车体耐久归零直接粉碎性解体。

### 3. UI 界面人性化与交互增强 (UI Humanization)
- **三档 HUD**：`Z` 或顶部 HUD 按钮依次切换完整 → 中等 → 极简，并在本浏览器保存选择。中等保留左右面板、相机入口与手机触控驾驶按钮，收起装饰、其余功能菜单与底部提示；极简只收起信息面板，始终保留驾驶触控、相机与重置。手机上三档均默认将两侧信息收进可展开/关闭的小入口，底部摇杆、模式选择和跳跃/定高/视角/重置不随精简而消失。两档精简模式均保留车外速度/气量仪表、接客方向与必要通知。FPV 仅使用车内实时仪表，不重复悬浮速度/气量。
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
| **M** | 选择世界地图 | 高架高速 / 赛博都市 / 海滨街区（原创压缩片区） |
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

## Persistent leaderboard / 持久排行榜

新增自愿参加的 60 秒积分挑战，按地图与物理模式分为四个榜单，每个匿名浏览器身份仅保留各榜最高成绩，公开前 100 名。昵称和成绩会公开，请使用化名。排行榜需要 Vercel Node.js API 和已配置的 Upstash Redis；直接打开单文件仍可进行沙盒模拟，但不能使用在线排行榜。服务端会过滤并验证昵称、请求结构、范围、身份、单次挑战编号、时间及频率，之后才写入榜单。浏览器端游戏无法完全防作弊。

See [deployment, API, security, privacy and testing details](docs/leaderboard.md). No production credentials are included. Development checks: `python3 bundle_app.py`, `npm test`, `npm run check`, `npm run build`. `npm run dev` serves the bundled game locally and returns a clear unavailable response until server-only leaderboard environment values are configured.

## Looping background music / 循环背景音乐

The user-provided `assets/Ludicrous_Velocity_bgm.mp3` is served unchanged (178.584 seconds, stereo MP3, 24 kHz / 64 kbps). A single player starts on the first permitted tap/key interaction and loops across vehicle resets, map changes, and game modes. Open **Settings → Pause music / Resume music** (also available from the initial map-selection screen). Pause preserves the playback position; the enabled/paused preference is remembered in this browser. Position itself is not restored after a page reload. Vehicle SFX uses the separate top-bar SFX control. Music temporarily pauses while the page is hidden and resumes when visible if enabled, subject to browser autoplay restrictions. If playback is blocked, Settings provides a retry. Settings initializes before the WebGL world.

`npm run build` copies the MP3 into `public/assets/`; serve the site over HTTP rather than copying only index.html. `npm run dev` supports audio GET, HEAD, and byte-range requests. Run `npm test`, `python3 tests/lua_runtime.py`, `npm run check`, and `npm run build` for local regression checks.

Settings also provides **Simulated engine sound / 模拟音浪**. It defaults to on, remembers its own on/off preference in this browser, and fades the synthesized motor hum in or out immediately. Turning it off leaves thrusters, tire screech, collisions, alerts and background music under their existing controls. The setting works before audio initialization and survives vehicle resets, map changes, challenge restarts and page reloads. It does not create or resume an AudioContext by itself, and the top-bar SFX mute still takes precedence.

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

每次真正撞毁后，先按原规则结算车内乘客遇难的双倍车费扣分（最低 0），再冻结并显示本局里程与接客最终成绩；死亡动画和等待复活期间不再增长或清空。复活、按 R 或移动重置开始新一局时，里程、驾驶积分、接客累计与已送达计数才统一归零。已提交的历史排行榜成绩保留，正在进行的 60 秒挑战仍立即取消并释放服务器会话且不提交；轻微非致毁碰撞不结束本局。弹窗在小屏可滚动，修复/换地图按钮可达。

## High-speed retro braking / 高速逆喷制动

### Continuous normal-mode boost release / 普通模式喷气余速连续回落

The 200 km/h normal EV ceiling limits electric propulsion, rather than instantly clipping existing jet-boosted speed. On both highway and city ground paths, releasing the rear jet above 200 km/h preserves momentum even with W held. Passive deceleration uses the existing aero-plus-roll resistance curve, multiplied by exactly 1.3 above 200; a crossing frame uses ordinary resistance for its below-200 remainder. With W released, the car coasts continuously through 200. With W held, excess speed coasts down to the electric ceiling and W then maintains it. Normal below-200 coast, handbrake tire scrub, active H/S retro braking, Plaid/Fantasy limits and airborne drag retain their established behavior. W plus handbrake also preserves existing overspeed instead of snapping to its lower drift-drive limit.

Regression checks execute production movement/altitude code for 250/300 km/h jet-release transitions with and without W, zero and variable frame time, 30/60/144 Hz, exact 1.3× resistance, 200 km/h crossings, empty tanks, H/S throttle overlap and handbrake overlap. These deterministic checks do not constitute real WebGL playtesting.

H foot braking automatically adds cold-gas retro thrust above 200 km/h on both maps. The demand feathers smoothly from zero at 200 to full thrust at 240 km/h, and tapers back to normal braking below the threshold. S also shares this high-speed assist while keeping its reverse-drive function; airborne H/S retain the existing low-speed manual retro control. Keyboard and touch buttons use the same controls. The established W/semicolon throttle priority remains: release the accelerator to engage H/S braking. U continues to be the momentum-preserving handbrake.

The added force is limited to the package's 80 kN divided by current vehicle-plus-gas mass, approximately 40–43 m/s². Full retro demand uses 0.55 tank-seconds per second (33 L/s); feathered demand and the last available gas fraction scale the impulse and tank debit together. H+S requests a single retro burn. The impulse opposes actual world-space travel, including backward/vertical flight, and clamps at zero instead of accelerating through it. Exhaust selection follows the full 3D vehicle heading. Ground, roof and helipad refill pauses while retro jets fire. The flow display measures actual combined tank debits, and tank seconds/liters/mass remain shared across cockpit and HUD modes.

Air brakes now retain passive aerodynamic drag, fixing the earlier behavior where H/S removed that drag and could slow less effectively than simply releasing the throttle. An empty tank still allows mechanical ground braking and passive air drag; retro depletion itself no longer adds an artificial downward velocity kick. S brakes an already-fast reverse landing progressively instead of instantly snapping its velocity to the reverse cruise limit. Foot brake plus handbrake retains ordinary braking below the retro threshold.

The bottom-right city passenger score is a single live number, retaining the existing passenger-score calculation. The destination indicator sits in the safe top-left corner, with live remaining meters below its rotating arrow and no title or background frame. The white-beam pickup radius is 4 m (doubled from 2 m); the green destination radius remains 2 m, and grounded-only arrival validation is unchanged. Driver score, destination-bearing calculation, cockpit passenger status and scoring rules are unchanged.

Regression coverage includes the 200/240 boundaries and both HUD speed units, supersonic speeds, 30/60/144 Hz threshold fade, full/partial/empty tanks, combined-jet accounting, refill exclusion on ground/roofs/helipads, forward/reverse/vertical/flipped travel, throttle/brake/handbrake combinations, touch release/cancel, and passenger-score lifecycle changes. The tests execute production movement, altitude, attitude, input and score code in deterministic frame harnesses. The available cloud environment cannot initialize WebGL, so these checks do not constitute real-browser gameplay or visual validation.

## Clear forward cockpit view / 座舱前路视野

FPV uses a higher fixed driver eye and hides the opaque A-pillar rails in that view. The original animated 3D yoke now has a close driver-sized pose, with a deep dark dashboard fascia, top ledge, column socket and a physical steering-column connection behind it. This prevents the white exterior hood from reading as the wheel's background. The lower bridge may crop naturally at full lock; the hub, shift LEDs and useful grip surfaces remain visible. The complete live instrument pod is centered in the viewport. The large wheel sits visibly to the left in a left-hand-drive layout, beside the centered screen on wider views and below it on square/tall screens. The column socket stays behind the central display, with a physical shaft connecting it to the left wheel. Responsive sizing retains about 100 CSS pixels of screen height where possible, including short landscape, so the 20px canvas telemetry labels project to at least 9.5 CSS pixels across the regression viewports. Short portrait and tablet windows derive the left wheel’s turning envelope from the actual pod bottom, preserving legible telemetry and live hub/LEDs instead of shrinking the canvas. The upper roughly 65% stays available for the road. Leaving FPV restores the original exterior/showroom poses and hides the interior-only dashboard. Field of view stays at 60 degrees and cockpit shake remains disabled.

Regression checks execute production resize/visibility code and real generated triangles across the reported 2048×1163 screenshot size, desktop, square, phone portrait and short landscape dimensions. They check meaningful wheel proportions, column endpoints and mount contact, dark dashboard backing in front of the white body, hub/LED visibility through steering, every instrument band, exact viewport-center/left-wheel placement, projected text-size floors, triangle-level clearance across the complete live display, road sight rays, near-plane clearance, repeated perspective changes and resizing. A CPU depth-buffer silhouette preview can inspect the geometry hierarchy without browser access, but it does not reproduce game lighting, textures or text readability and does not substitute for WebGL visual validation.

External headlamp lenses have forward-facing triangles without duplicate glowing backfaces. The center bar, both eyebrow lights and ten projector bars emit only from their forward box face; their sides and driver-facing backs are opaque dark housings. Cockpit view excludes the exterior lamp/hood-louver/shutline details that previously showed exposed backs. Actual forward SpotLights continue illuminating the road, and outside views restore all those details.

## Smooth body surfaces / 连续车身曲面

The body and canopy now carry shared, shape-preserving cubic tangents through their longitudinal sculpting stations instead of flattening at every station. Curved cross-sections retain every original landmark while replacing wide planar bands, with symmetric surface-tangent normals. The cabin recess also blends with zero endpoint slope. Wheel-opening boundaries, body dimensions and exterior panel details are retained. Canopy rails follow the same smooth profile as the glass.

Vehicle paint and glass reflections are softened without changing world lighting or wet-road rendering. All 12 paint presets retain their individual color/metalness/roughness, and paint changes keep the softened clearcoat. Added tests cover interpolation continuity, nonzero moving-contour slope, no overshoot, sculpting-anchor preservation, cross-section symmetry, finite unit normals, upward winding and exact wheel-arch cuts. Real WebGL appearance still needs device/browser visual validation.

## Closed traffic bodies / 封闭车流车身

The shared traffic-car body now has exact front/rear silhouette caps with separate outward-facing hard normals, plus an opaque carbon backing across the lower rear diffuser. This closes the previously open ends that exposed the road, wheels and interior behind the taillight. The sculpted shell, wheel cuts, paint palette, lights, wheel animation and gameplay bounds stay unchanged. Tests cover finite nondegenerate cap triangles, winding, exact boundary matching, all-color sharing and end-silhouette ray coverage from following and three-quarter positions.

## Compact exterior air gauge / 简洁车外空气槽

The exterior gauge is labeled “空气槽” / “AIR TANK” and shows only the remaining seconds beside the live air bar. It omits the total-time denominator, capacity suffix and entire used-jet-time row. Status, flow, the descent warning and real gas consumption/refill calculations stay unchanged. The separate in-cockpit readout is unaffected by this exterior-panel copy change.


## Earth-gravity unpowered flight / 无喷气地球重力

Altitude `state.y` is in meters and `state.vy` is in m/s. Unpowered vertical motion uses constant Earth gravity, **9.81 m/s²**, independently of remaining air, Realistic/Fantasy mode, attitude, and the horizontal optical-flow multiplier. Release and depletion retain the current vertical velocity. From rest, the ideal ballistic reference is 4.905 / 19.620 / 44.145 meters fallen and 9.81 / 19.62 / 29.43 m/s downward after 1 / 2 / 3 seconds. Existing lift, hover, jump, active descent, retro braking, horizontal drag, landing assistance, damage and refill controls remain separate.

This is a near-Earth, ideal ballistic vertical model; the package has no measured vertical drag area, so there is no claimed measured terminal speed or invented vertical drag coefficient. Analytic position integration avoids FPS-dependent falling distances, and crossing a road or supporting rooftop retains contact-time impact velocity for the existing landing/damage rules instead of integrating through the surface. Test with `node --test tests/freefall.test.mjs`, then run the full checks above.


## Inertial jump and flight / 起跳与空中惯性

The O jump retains the complete pre-launch horizontal velocity vector on both maps, including backward travel and drifting. Its vertical impulse immediately switches horizontal motion out of tire-grip control. Unpowered air coasting uses the existing ground aerodynamic term, `dv/dt = -0.00012 v²`, without rolling resistance or an artificial stall brake. The exact drag solution preserves direction and produces matching speeds at different frame rates; merely pitching/yawing/banking an unpowered vehicle does not turn its travel vector. Powered rear-jet limits constrain the additional impulse instead of clipping existing momentum. City ground and air movement both use `CITY_WORLD_SPEED_SCALE = 1.0`: one world metre per physical metre. The highway retains its existing arcade traversal calibration. Mechanical/retro braking and actual lateral RCS remain available.


## Final crash score and new-round reset / 撞毁成绩与新局清零

Actual destruction on either map freezes and displays the completed round's driving score, physical mileage, speed-band accumulators and vehicle counts. An onboard passenger is lost once, deducting twice that fare with a zero floor before the final passenger score is preserved; an empty taxi retains its earned fares. Wreck frames, shockwaves and late callbacks cannot grow or erase the frozen result. The crash summary, side HUD and cockpit remain consistent. Respawning, R, button/mobile reset or another caller of the shared vehicle reset starts a fresh round: all driving accumulators, passenger points and delivered count are zeroed, and old loss notices are cleared. Nonfatal collisions preserve the current round. Ranked crash cancellation still ends/releases the current server run immediately, independently of the local score display, while previously completed/submitted ranked snapshots and historical records remain untouched.

## Compact launch setup / 紧凑首屏配置

The launch screen replaces the always-expanded twelve-paint grid with a clickable preview of the actual Roadster model. The preview uses the shared paint material and automotive studio environment and renders only on configuration changes or resize. Open it to compare all twelve finishes in a native dialog; Done, Escape, a backdrop click, and browser/phone Back dismiss it and restore focus. Immediate repeated open/close actions wait for the previous history transition. The chosen finish is saved by stable preset ID in this browser, and storage failures do not block play.

World and weather choices stay inline alongside driving mode and traffic density. Native buttons/selects support keyboard activation and visible selection states. The launch action stays outside the scrollable configuration region; very short windows can scroll the choices without losing it. Phone layouts reduce preview/spacing while retaining 44px controls. Audio and language remain available from the header. A focused setup control no longer treats Enter/Space as a global launch shortcut or changes driving inputs.

Regression checks execute the real configuration handlers for all finishes, storage restore/denial, retained focus, repeated dialog openings, Back/Forward/Done/outside dismissal, keyboard launch safety, mode/traffic synchronization, preview reuse and its optional failure fallback. These deterministic DOM tests do not substitute for visual or real-browser WebGL validation.

## Mobile dual joysticks / 手机双摇杆

Phones and tablets with a primary coarse pointer use two independent joysticks in Full/Medium HUD, in both portrait and landscape. Desktop keyboard and fine-pointer controls stay unchanged. The old mobile driving-button grid is replaced. A neutral resting touch does nothing; drag outside the 14% dead zone, farther for more force. Releasing either thumb centres only that stick.

- Left: horizontal steering (yaw while airborne), up throttle, down foot brake. A braking pull stays a brake through zero speed. Centre and pull down again once stopped to reverse; an initial downward pull at rest also reverses.
- Right selector defaults to Lift / 升降: up lift, down powered descent, horizontal airborne strafe. Attitude / 姿态 maps vertical pitch and horizontal roll. Boost / 喷气 maps up rear jet, down handbrake drift, horizontal airborne strafe. Changing mode releases both sticks and requires fresh touches. Modes are intentionally not persisted.
- Small Jump / Hold / View / Reset utilities keep the existing jump, altitude-hold toggle, camera and reset actions. Altitude hold continues consuming air until toggled off or cancelled by manual lift/descent. Airborne throttle still uses gas, as W does.
- Joystick values scale production acceleration, braking, reverse, steering, jet/strafe/attitude forces and gas burn. Partial lift also supplies only its proportional gravity compensation. Keyboard commands retain full strength and independent ownership.
- Pointer cancellation/capture loss, blur/backgrounding, page exit, resize/rotation, primary-pointer changes, modal dialogs, HUD hiding and reset all centre the sticks. Touch-action suppression is confined to the stick pads; menus keep normal scrolling and selection.

The in-game bilingual Help includes this mapping. Automated VM tests cover concurrent pointers, interruption/re-arm flows and production analog physics. These checks do not replace real-device/WebGL playtesting.

## Reference Roadster 2 and preserved classic / 参考款与经典款

The compact entry setup now offers independent exterior and cockpit choices. Reference Roadster 2 and the reference cabin are the defaults; Classic Roadster and the complete earlier cockpit remain available in any combination. Each choice is saved locally, with graceful fallback if browser storage is blocked. All twelve paint finishes still share the existing paint pipeline.

The new code-native exterior follows the supplied front, roof, interior and rear references: broad low wedge hood, inset triangular forward-only headlights, cross-nose light, black panoramic canopy with white shoulders/rails, recessed continuous rear lamp band, closed deep diffuser, open metallic four-jet outlets and an animated white rear wing. The new cabin has a satin-edged padded U-yoke, dark sculpted dashboard and a physical steering-column mount. It retains the centered live speed, actual air-tank state and passenger instruments and established responsive left-hand-drive projection. Exterior lamp backs, glass, pillars and the two high shoulder panels are hidden in cockpit view; real road lights and all functional jet effects stay active.

The preserved classic shell is also a shared low-detail traffic variant (3,200 body triangles, shared geometry/materials), mixed evenly with sculpted touring and track cars. All variants retain the existing traffic wheel handles, collision dimensions and behavior. No model selection changes physics, scoring, tank consumption, steering inputs or challenge rules. Neutral studio sources are captured separately from driving poses, reuse geometry/materials, and never inherit a hidden canopy, a turned wheel or active plume.

Regression coverage includes independent choice persistence/restore, repeated view/model transitions, preview reuse, forward lens winding, finite smooth surface normals, axle/fender clearance, closed diffuser backing and NPC resource sharing. Release verification also uses the production Three.js r128 meshes for projected-wheel and road/instrument occlusion checks. CPU geometry projections support reference comparison; they do not replace real WebGL rendering or interactive device validation.

## Brief launch carry, responsive flight / 短暂起跳惯性与灵活飞行

A grounded or rooftop O jump preserves its inherited horizontal vector for the first 0.25 seconds, apart from the gentle launch aerodynamic drag. Over the next 0.60 seconds, a smoothstep handoff restores the earlier strong horizontal release-braking curve and bank assist. Sustained powered flight also damps sideslip toward the aimed nose, so yaw turns change the travel path promptly. Both maps use the same handling transition. Q/E side jets remain available during the launch grace; in-air O presses cannot restart the grace.

Powered overspeed settles continuously toward the flight envelope instead of an instantaneous speed clamp. These are horizontal gameplay assists; the unpowered vertical path remains analytic 9.81 m/s² Earth gravity, with no downward injection or terminal-speed cap. Ground EV/boost coasting, paid retro braking, attitude grace, crash effects and crash-score rules retain their existing behavior. Reset and landing clear the launch transition.

Regression checks cover actual O launches, powered and unpowered handoffs, A/W and D/W turns, bank/strafe response, mode changes, repeated airborne O, reset, both maps, irregular frames and 30/60/144 Hz, alongside the existing vertical ballistics, tank-depletion and collision tests. Visual gameplay verification still requires a WebGL-capable browser.

## Earlier electric-drive sound and reference-model responsiveness

The earlier motor simulation used a quiet, rounded sine-based electric hum, fading to
silence at rest with separate engine/SFX/music controls. Detailed visible
reference meshes remain unchanged; two bounded silhouette batches replace 108
individual shadow casters. Camera/model visibility updates are cached rather than
repeated on every frame. See [investigation and verification limits](docs/audio-input-latency.md).

The current optional engine voice replaces that hum with an original procedural
V8-inspired exhaust sound: two coherent pulse banks, a low bass layer and filtered
air texture respond smoothly to speed and actual analog throttle. It is not a
Tesla engine recording, and no V12 selector is included. The persistent simulated
engine switch remains independent of BGM and rocket effects; SFX mute and
destruction still silence it. See [sound implementation and listening limits](docs/engine-sound.md).

## Mixed highway drivers and distance scoring / 高架速度分组与里程积分

Highway drivers now have a stable, randomly sampled personal cruise target: 10% racers at 160–180 km/h, 40% at 70–80, 30% at 80–90 and 20% at 90–120. Small traffic pools use largest-remainder rounding (20 cars: 2/8/6/4, 36 cars: 4/14/11/7, 52 cars: 5/21/16/10), shuffled independently of lane and appearance. Drivers brake for slower vehicles, actively consider useful adjacent gaps, and resume their personal target when clear. Racers react sooner, use shorter but continuous lane changes and shorter cooldowns. Simultaneous merges reserve both lanes; the player and low wrecks retain conservative rear-closing protection. Initial traffic is balanced across all six lanes, with birth speeds reduced when necessary to fit the front braking gap while preserving desired cruise targets, and out-of-view wraps prefer safely available, less-occupied lanes. No in-view lane teleporting or random per-frame speed rerolls are used. City traffic speeds are unchanged.

Both maps now use distance-only driving points: ceil(sum of each forward-travel segment's physical horizontal metres ÷ 10 × its speed multiplier). The highest applicable multiplier is 1.2 at 180 km/h, 1.3 at 200, 1.4 at 240, 1.6 at 300 and 1.8 at 350; bonuses never stack or upgrade earlier distance. Acceleration/braking segments split at exact thresholds; fractional points accumulate before a single display ceiling, avoiding frame-rate inflation. Metres use physical horizontal m/s capped by the calibrated speedometer source (so highway lateral handling cannot inflate mileage), excluding the 1.65 optical/world venue multiplier. Idle, reverse, pure lateral sliding and vertical hovering add no distance. Passing counts remain statistics, while old pass/blast/stunt/helipad/sonic point awards are removed. Passenger fares remain separate. Destruction freezes the final score after passenger-loss settlement; manual/map reset or respawn clears all driving and passenger round totals for the next round.

The optional 60-second leaderboard uses the explicit distance-v2 protocol and separate versioned board/name keys. Old-rule records are retained untouched and are not mixed with new scores. Reloaded clients submit six cumulative speed-band metre totals; the server recomputes the final score, enforces category-specific maximum-distance/time plausibility, and preserves the existing signed browser identity, server timing, ownership, cancellation, replay and rate-limit checks. Old clients/runs are rejected safely. Client telemetry remains forgeable, so these checks do not make the casual leaderboard cheat-proof. No storage migration or credential changes are required.

## Exterior windshield water / 玻璃外侧雨滴

Cockpit rain now uses eight tiny, slowly sliding beads attached 1.2 mm outside
the selected model's actual glass triangles. Reference and classic glass use
their own visible side bands; the camera and existing instrument layout stay
unchanged. The former all-view, full-screen rain overlay is removed. Exterior
rain checks complete streaks against the moving, rotating cabin enclosure, so
particles cannot fall through the driver or dashboard. Dry weather, outside
views and destruction hide the glass effect, and switches reuse the same mesh
and buffers. See [implementation and verification limits](docs/cockpit-rain.md).

## Cold-gas and condensation visuals / 冷气喷流与凝结视觉

All propulsion/attitude outlets now use one soft, outward-only, depth-tested cold-gas envelope per active mouth. Actual paid input controls visual power, including analog controls, low-air states, hover and three-dimensional retro braking. Roll/pitch/strafe/yaw share their physical outlets rather than layering duplicate plumes. Classic and reference mouths are aligned independently, and FPV hides all plumes. The existing high-speed gameplay threshold creates a brief, travel-aligned condensation pulse instead of a persistent opaque cone/ring. Physics, gas burn, overspeed settling, retro impulse and scoring are unchanged. See [verification and CPU-render boundaries](docs/jet-effects.md); real WebGL appearance and FPS still require a working GPU browser.

The current visual revision broadens and lengthens the pressure wake without
moving the nozzle mouths or adding outlet meshes. Rear jets reach 2.35 m at full
power; the condensation pulse is slightly more visible but still expires in
0.8 seconds. While the existing high-speed condition remains true, only these
body-side wisps reappear a random3–5 simulation seconds after disappearing.
Their shape and opacity stay unchanged; repeat pulses do not replay the boom,
speech, banner or camera shake. FPV, lost focus/visibility, menus, destruction and
reset clear the effect and its delay, without queued background timers.
[Pressure review](verification/jet-pressure-review/README.md) records
the production-geometry checks and CPU previews, not a real-WebGL visual pass.

Top and side mouth hardware is now hidden without removing their plumes. J/L
roll uses side exhaust; top exhaust is only accepted Shift descent. This changes
display mapping, not physical attitude forces or tank debit. Freefall banner and
voice require established actual flight: road depletion and the complete O-hop
remain silent. A presentation-only hop marker persists through descent and clears
on touchdown or deliberate lift/hold, independently of finite inertia grace.

During autopilot, the left key panel uses exactly its existing manual held-key
animation for the latest applied controls and O-hop phase. This is display-only,
with no synthetic keys or input ownership changes; release, exit and focus/menu/
reset transitions clear it, while real shared-key aliases still aggregate.

## Highway autopilot / 第一关自动驾驶

Map 01 adds a small, opt-in Autopilot / 自动驾驶 switch with no shortcut. It supplies real driving/boost/brake inputs, accelerates normally from rest, and targets 220+ km/h. A multi-lane maneuver now steers continuously toward its final lane center; intermediate centers do not insert a straightening pause. The complete predicted sweep is checked for crossed-lane traffic. Mechanical plus paid retro braking is requested only when its predicted result remains at least 220 km/h; a slower queue instead prompts a pass or an earlier, real-gas tactical hop. Real finite tank, airborne drag, landing and collision limits still apply, so an impossible or fuel-starved situation can lose speed or crash. The switch stops cleanly on reset, destruction, map/mode changes, menus and loss of focus. Automatic driving stays isolated from the 60-second leaderboard. See [implementation, paired verification and limits](docs/highway-demo.md).

**Known limitation:** the current integrated demo has not passed the requested
all-mode, high-density 60-second collision-free acceptance. The sound/jet release
does not claim that driving target is complete; failed isolated driving
prototypes are not promoted into the game.


## City metre scale and continuous autopilot jets / 城市米制与自动驾驶连续喷气

City player motion, NPC traversal and wheel rotation now use the same metre scale as buildings and navigation. At200 km/h a300 m block takes5.4 simulation seconds, not3.27 seconds. Ground, takeoff and airborne horizontal paths share this scale; Earth gravity, acceleration, tyre behaviour and the highway map remain separate. The manual frame loop still caps an individual physics step at50 ms; severe low frame rates are not claimed real-time accurate.

The highway switch is now labelled **Autopilot / 自动驾驶** throughout its button states and ranking copy. It has no60-second auto-off timer: that duration belongs only to the voluntary ranked challenge. Manual exit, menus/reset/map changes, destruction, loss of focus/visibility and sustained rendering overload can still return control to the player. It is a game stunt controller, not a guarantee of collision-free driving.

Safe ground acceleration keeps the rear jet requested even at its physical speed limit, removing the former250/370-threshold on/off chatter. A finite following envelope feathers jet power continuously; slow traffic requests a lane change or funded hop without continuing ordinary acceleration into the blockage. The existing220 km/h floor, zero-start entry acceleration, finite planning budget, genuine collisions and paid hop preparation remain in force. Committed jump preparation uses its actual controls; later uncertainty is bounded by time-integrated maximum acceleration, not an instantaneous jump to the370 limit. Finite gas still needs its real reserve/recharge pauses, and a committed preparation can retain its single paid floor-protection pulse; these are not hidden free fuel.

The silent session-only infinite-air sandbox flag applies to every shared thruster and can change while autopilot is active or preparing. Enabling refills the shared tank; disabling preserves its current level and restores normal consumption. Both directions discard all future fuel-dependent proofs without changing the current pose or airborne landing lane. All three approximate predictions and the exact static/Node numerical mirrors use the same flag, including retro impulse and full-tank mass. Infinite mode cancels/blocks ranked runs; old immutable completed results remain separate. No new banner, speech, sound, key badge or settings prompt is added. Reset/map changes do not silently flip the flag; page reload starts finite again.

Fresh checks and the explicit numerical-epoch proof are in `verification/controls-city-scale/`. They do not constitute WebGL/listening/FPS acceptance or all-mode60-second collision-free acceptance.

## Map 3 · Original Coastal District / 原创海滨街区

The third map is an original, compressed seaside district inspired by the broad beach/pier atmosphere of Vespucci Beach and Del Perro Pier. It is **not GTA map data, a replica, or an imported Rockstar asset**. All buildings, palms, boardwalks and the slow-moving Ferris wheel are generated locally from simple geometry; there are no new map downloads, third-party map credentials or asset requests. Choose **Coastal District / 海滨街区** in the existing map menu and launch normally.

- The bounded2400m district has a west-facing sea/sand/promenade, two30m boulevards, cross streets and an inland loop.132 pastel low-rise buildings,100 palms, an original560m pier and approximately60m wheel make up the main landmarks. The spawn boulevard connects directly to the pier approach; this is a drivable scene, not only a menu card.
- Player/NPC movement uses1 world metre per metre. Independent12/16/20-car road routes exclude beach, water and pier. Ground contact with the sea safely respawns on the road; flight may cross water without invisible road recharge. The pier is solid. Map-local geometry, materials and instance buffers are built on entry and disposed on exit, without disposing shared car/NPC assets.
- Coast is initially **unranked**; the existing four highway/city leaderboard categories and city-only taxi job remain unchanged. Highway autopilot is not silently repurposed as a city/coast navigator. Existing map1/2 physics and the previously published controls/effects remain isolated.

`verification/coastal-district/` records exact-source regression, road/surface/contact/lifecycle checks and CPU scene structure. Static triangle/mesh counts exclude vehicles, shadows and renderer passes; they are **not measured FPS, total draw calls, a WebGL visual acceptance, or a promise of60fps/30fps**. Severe low-frame-rate simulation still has the existing50ms step cap. The original all-mode60-second collision-free autopilot target is not claimed complete.


## Phone driving visibility and cockpit calibration

On coarse-pointer phones, the existing toolbar is a single horizontally scrollable row; HUD, camera and reset remain immediately available. The two information cards start folded in Full/Medium and open one bounded, closable sheet at a time. Minimal removes information, **not driving inputs**. Both independent sticks, the right-stick mode and Jump/Hold/View/Reset remain usable, while menu/destruction/blur cleanup and fresh-touch requirements are preserved. Portrait instruments reserve space above the central utility buttons; short landscape uses a separate utility column. Screen rotation clears old pointer ownership rather than replaying thrust.

The common FPV eye is now1.04m above the vehicle origin, below both actual roof meshes, rather than above the lower reference roof. Camera, projected dashboard and windshield rain use the same calibrated pose;60° FOV,0.08m near plane, car attitude transforms and physical forces are unchanged. Actual r128 geometry tests check roof clearance and sight through the front windshield for every body/cockpit combination. These are geometry checks, not a claim of WebGL/FPS or listening acceptance.
