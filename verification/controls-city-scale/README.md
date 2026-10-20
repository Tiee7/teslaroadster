# Silent infinite air, city metres and continuous autopilot — 2026-10-20

## Scope
- Main row0 and keypad0 toggle a session-only shared infinite-air sandbox mode,
  without adding a toast, badge, sound, speech or settings hint. Repeated/held keys,
  text/dialog input, browser modifiers, focus and hidden-page flows are covered.
- Active/pending autopilot accepts the switch. All future fuel-dependent jobs,
  certificates and prefetches are invalidated; actual pose, landing target and
  committed cooldown are retained. All three approximate predictors and the
  exact numerical mirrors share the49-field fuel contract.
- Infinite mode cancels/blocks ranked play. Completed immutable results remain
  independent. Reload returns to finite gas; reset/map changes preserve the flag.
- City player/NPC motion and player/NPC wheel spin use1 metre per metre. At200 km/h
  a300m block takes5.4 simulation seconds rather than traversing495m.
- The UI name is Autopilot / 自动驾驶. Safe jets stay requested at the physical
  limiter instead of chattering at250/370. Following demand feathers continuously.
  Startup can still reach220; dangerous traffic pauses ordinary extra boost.
  The220 floor and its genuine paid protection remain unchanged.
- The existing body-side condensation wisps retain their shader, shape and0.8s
  pulse, then repeat after a random3–5 seconds of eligible simulation time. Only
  visuals repeat: no repeated boom/speech/banner/camera shake or extra geometry.
  Trigger loss, FPV, menus, focus/visibility loss, destruction and reset clear
  both pulse and delay. No timers or queued background callbacks are introduced.
- Ground tank depletion and the complete road O-hop do not emit the freefall
  banner/voice. Only actual established flight beyond finite hop grace can do so.
  An alert-only road-hop marker persists through descent, clears on touchdown,
  and yields to deliberate lift/hold. It never changes gas, forces or trajectory.
- Top/side mouth hardware is hidden, but plumes remain. J/L uses side plumes;
  top plumes respond only to accepted Shift descent. Physical forces are unchanged.
- The existing key badges mirror the latest applied automatic control output,
  using the same active style as manual keys. No input events or key-map writes
  are synthesized; releases, pending/exit and focus/reset/menu paths clean up.

## Two driving regressions caught and repaired before publication
1. A first danger-pause draft stranded zero-start at the200 EV ceiling, below
   the220 hop entry. The old52-car seed7 crashed at3.5s before its first jump.
   The entry-acceleration exception restores the original20s regression.
2. Reusing370 as an instantaneous post-hop speed widened the candidate envelope
   beyond actual acceleration. The corrected bound uses the committed motion
   through cooldown, then integrates maximum real acceleration from handoff speed.
   The old safe-B and terminal-arc fixtures are retained and pass again.

The long-route sweep fixture retains its original obstacle, explicitly verifies
that it is genuinely passed under the faster trajectory, and adds a second
obstacle at the now-intersecting phase. The original full-sweep, late-prefix and
safePath rejection assertions are retained; no collision is invented or removed.
`final-lane-witness-migration.json` records the measured crossing.

The following-demand fixture likewise keeps its original80m lead position and
checks that neither predictor nor actual execution invents braking solely for
the retired250 cruise cap. Its real H/retro/gas matrix uses40m, where the actual
following envelope is below the player's75m/s; existing multi-frame80m safety and
independent binding long-frame brake checks remain intact.

## Evidence boundaries
- `verify-fuel-equivalence.mjs` compares the prior published tree with fixed-input
  default finite highway physics, and current Node projection with actual extracted
  production motion/contact/G. Twelve cases ×30 frames ×49 fields use Object.is.
- `tests/infinite-jet-prediction.test.mjs` additionally compares the static browser
  numerical core to those same actual helpers. It does not execute WebGL/rendering.
- Identity/mirror guards cover source mutations and stale generated artifacts.
- Earlier diagnostic/failed/interrupted logs remain local with their original
  outcomes; they are not relabelled as final passes or bundled with failed
  Tactical/rolling prototypes. Source changes use an explicit release whitelist.
- V3 was interrupted for condensation recurrence; V4 was interrupted after280
  passing cases when the later flight-alert/nozzle/key-badge requests arrived.
  The final full run must match the newest frozen runtime, not either old preview.
- V5 exposed an isolated old gauge-test context missing its now-read airborne
  flag. That fixture now supplies the real dependency and adds English/Chinese
  ground/O-hop/flight caption checks. Runtime stayed frozen; V6 is the complete
  serial acceptance run with this corrected test set.
- Finite air still requires reserve/recharge pauses. Already committed preparation
  may retain its single paid220-floor pulse. Manual frames below20fps still hit the
  existing50ms timestep cap. These are disclosed constraints, not hidden free gas.
- No all-mode60-second collision-free, WebGL appearance, hearing or FPS acceptance
  is claimed. Existing cloud-browser limitations remain; current user accepted them.

Final counts, frozen hashes, branch/commit/deployment IDs and remote readback are
recorded only after their respective steps have actually succeeded.
