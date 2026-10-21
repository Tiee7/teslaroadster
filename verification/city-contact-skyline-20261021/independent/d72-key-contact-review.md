# 最终碰撞候选独立只读复验

**冻结候选：`d72efc4778dcc8f8954bebbe314dbf8e28f4cff6`。结论：所授既定关键集合全部通过。**

基线为 `39169ed88babd1089954212c499c6b0a94eb55d8`。未运行199中间版仿真，未修改repo，未check/test runner/build/部署；未覆盖旧版证据，没有扩大原版采样域。0ad的既有84道路/454楼旁完整批次已先取得终态；d72只重放关键集合，不把0ad全域数字冒充d72全域结果。

## 四类旧反例已消失

1. **楼旁横向空隙**：原b0 1.5m侧距、完整车体0.482002m净空的W轨迹，候选182帧完整通过，0接触、hull100、0爆炸；2.0m对照同样通过。
2. **EW/侧飞NPC隔空接触**：原地面/0.7m低飞/侧飞3轨迹分别延长至2s，均0接触、hull100。原致死前59/69/52帧的输入与11项物理状态逐帧逐值完全一致。
3. **真实死亡/爆炸/重置后的浮空NPC鬼影**：原合法车道reset案例，旧5帧致死时near LOD垂直净空3.683268m；候选重生后W持续1s仍0接触、hull100。真实lazy city bounds getter已wire，production先生成raw near/far union，未退化到fallback尺寸。
4. **高空隐形边界**：默认spawn、常规模式、有限气箱、同一W/H/idle/Space/N+;控制轨迹，在旧致死的200帧前缀后仍到`(6,51.762536,-1197.850602)`、hull100、0爆炸；70.7m另一旧致死667帧前缀也hull100。四向45.31/60/100/380m长轨迹均可越过1200、不被旧1197.8夹紧。

有限气箱只比较**原版已经死亡的相同输入前缀**；继续耗空燃气后真实坠地死亡不等于隐形墙回归。具体窗口见 `prefix-and-positive-audit.mjs`。

## 真实碰撞与功能仍保留

| 正例 | 最终候选结果 |
|---|---|
| b0真实正撞（gap0） | 128帧，22.628571G，hull0，真实爆炸调用 |
| NS/EW高速真撞车 | 均39.399107G，真实毁车，hull0 |
| NS/EW低速真撞车 | 均15.508929G，hull100→33.521799，未毁车 |
| 真实低墙中速接触 | 13.805357G，hull100→45.134681，未爆炸 |
| 真实低墙高速接触 | 28.719643G，hull0，真实爆炸调用 |
| 18m低楼与76m停机坪正常落地 | 正确停在实际高度，有限气箱回满10，hull100 |
| 屋顶/N合同 | 三处物理footprint与UI N一致；楼旁旧空隙无假屋顶支撑，真屋顶和真实旋转车头搭边仍有支撑 |

没有关闭碰撞、取消扣血或提高致死阈值绕过。95项既定场景CPU探针全部通过，含真低墙、有限高度、边界有限跨度、屋顶/N合同和真楼面损伤。

## 最终姿态合同独立核实

- 玩家实际渲染组 `vehicles.js:13` 是 **YXZ**；NPC实际默认 **XYZ**。最终 `physics-main.js:350–380` 分别使用正确顺序。
- 原生Three r128分别对玩家YXZ、NPC XYZ各27姿态计算真实旋转矩阵，共 **54项，0失败**，最大轴分量误差 `1.1102230246251565e-16`。
- 使用**真实neutral preview车型**，不是fallback，复查实际b0屋顶角：姿态`(-939,17,-1030.8), pitch=π/4` 的XZ投影确实压过屋顶边，但真实3D没有接触，`cityBuildingContact`返回null；同姿态降到y15，真实低头/楼面交叠仍返回有效接触。
- 依据 `physics-main.js:397–413`：屋顶投影与伤害接触分开，真实3D墙面接触先经15轴确认。

## 证据文件

- `prefix-and-positive-audit.mjs`、`prefix-and-positive.log`：旧致死前缀、楼旁真假接触、低墙/屋顶正例。
- `boundary-*.json`、`building-grazing-continuous-repro.json`、`positive-controls.json`：连续轨迹与真实生产伤害/爆炸调用。
- `scene-review.mjs`、`scene-results.json`、`scene-output.log`：既定95项场景探针，0失败。
- `pose-matrix-audit.mjs`、`pose-matrix-results.json`、`pose-matrix-output.log`：54矩阵核对与实际屋顶角真假接触。
- `npc-review/report.md`、`replay.mjs`、`result.json`、`summary.json`、`frozen/`：4旧NPC轨迹身份、lazy bounds证据及4真实高速/低速撞车正例。

方法边界：生产运动/伤害/毁车真实执行，只有DOM/声效/绘制接收器无副作用；真实Three CPU场景/preview/near LOD被接入。不声称浏览器/GPU像素、实际FPS或发布版本验收。本结论仅指上述冻结碰撞候选，不替代唯一writer之后建筑/天空未提交改动的视觉验收。性能、10人接送、V8及H静音未被本审计修改。
