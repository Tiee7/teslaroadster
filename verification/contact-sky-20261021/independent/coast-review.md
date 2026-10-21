# Coast candidate review — 2026-10-21

Original source/old-root-cause evidence remains in REPORT.md and results.{30,60,144}.json. No repository edits/check/build/deploy or GPU activity performed by this reviewer.

## Version control of audit evidence

- V1: first uncommitted candidate with actual YXZ bounds/SAT conservative advancement, full-displacement bound and 96-iteration null fallback. Main old false-death witnesses passed at 30/60/144. Geometric and actual production shallow side-contact probes exposed missed true contact. This was reported immediately and corrected by the sole repository writer. Early V1 evidence is summarized below; the tool transcript retains exact original output.
- V2 frozen physics SHA256 `832b032d3dce9bd326c896f017cc885d2f15d8975ebd68522d48d963c5d38df1`; source `candidate-v2-832b032d-physics-main.js`. Exact constant-orientation swept SAT + rotating fallback + angular feature normal speed fixed the shallow miss. All nine old legal-meeting witnesses passed (3 scenarios × 3 rates). Response-only rotating fuzz found residual overlap because depth from final MTV was applied along first-contact normal. Reported and corrected by sole writer.
- V3 frozen physics SHA256 `0fa3f071ae46bdbbc5585e04ef0d8f3410efc68f6f6e35ed82253b51ab70d778`; source `candidate-v3-0fa3f071-physics-main.js`. Final-pose MTV response and early root-sphere broad phase. Results below refer only to this frozen source, independent of subsequent repository edits.

## V3 correctness results

Main external continuous-motion replay at **30 and 60 Hz**: all three original flat/slope/bridge witnesses survive, true head-on still destroys at 45.3571 G, normal 3.5 m straight lane meeting and actual 22.5 m bridge-over-bypass crossing survive. Main 144 Hz replay initially stopped by a resource-pressure SIGKILL during an overly concurrent six-process launch, not by an assertion. Retry is pending at five-minute interval; do not misreport its completion. The same 144 Hz witnesses had already passed on V2.

Full-motion 60 Hz minimum certified gaps on V3: flat1.665m, slope.768m, bridge2.026m. These are for the complete encounter, not just the early old-death interval. Detailed replay: `reproduce-candidate-v3.mjs`; outputs `candidate-v3-results.{30,60}.json`.

### Shallow true contact / false contact controls

Actual production motion, one1/30s step, fantasy flight with existing lateral momentum; real stopped coast NPC on route0 s100. Player relative root initial `(2.15,.2,-4)`, yaw0, `vx=-9,vz=250`, `vy=0`, no thrust. Production ends at `(1.8775488825,.19455,3.5680865980)` relative NPC. Actual player/NPC OBBs overlap .16045m at endpoint. V1 incorrectly returned null / hull100; V3 detects certified swept contact and applies **5.2544G**, hull88.8549. `vx=-18` correctly yields **10.5075G**, hull65.0300.

High-pitch variant: player `pitch=PI/2, y=2.35`; end bodies are already separated by1.268m in Z, but the continuous chord crosses NPC. V3 detects real intermediate overlap (.1107m for vx-9, .3184m for vx-18), applies the same correct normal-speed damage. Shallow-clear vx-3 versions have zero contact/hull100, both horizontal and pitched. This checks true swept contact, not merely endpoint overlap.

16 exact native-bound geometric shallow-contact probes (half longitudinal travel2/4/8/10m × lateral half-delta.01/.05/.1/.3m) all report contact with exact swept SAT. Pitched overhead negative gaps (+.3m) remain clear; lower positions(-.3m) collide. These are geometric unit checks, distinct from production trajectory cases above.

Files: `candidate-angular-v3.mjs`, `candidate-v3-geometric-probes.json`, `candidate-v3-dynamic-shallow.json`, `candidate-v3-angular.log`.

### Rotation, high pitch/roll, normal impulse

Rotation-only scripted90° sweeps using the exact production collision response:

- Pitch over NPC from rooty2.6: actual contact, 18.3332G fatal at dt.1s; separated side pitch rotations remain clear.
- Yaw from rootx2.6: actual contact,18.6251G fatal at dt.1s; elevated yaw rooty2.6 stays clear.
- Roll rootx2.4: real edge swing contact6.1756G; rootx2.6 has no contact.
- These tests deliberately specify scripted high-angle chords to exercise the contact engine; they are not represented as naturally reached keyboard rates or GPU play.

100 seeded rotating-response fuzz trials include a precise previous V2 residual-overlap witness (`fuzz-35`, ~4.93cm penetration after response). All previously flagged response overlaps are clear on V3. No remaining-overlap warning in `candidate-v3-angular-response.log`.

Actual production keyboard-controlled continuous rotation from rest (150frames /2.5s, real motion/tank/attitude/hover, no scripted orientation interpolation): yaw near NPC produces contact starting frame32 and legitimate nonfatal damage; pitch above NPC contacts starting frame48 and gentle bouncing/nonfatal damage. Clear side/elevated controls retain zero contacts/hull100. Post-response gap in these actual positive runs stays >=.0001m on V3; V2 had up to1.04cm residual penetration. Production roll case tested was geometrically clear and remains clear.

Files: `candidate-response-probe-v3.mjs`, `candidate-v3-angular-response.json`; `candidate-production-rotation-v3.mjs`, `candidate-v3-production-rotation.json`.

## Nonblocking performance observation

Native player/NPC XZ overlap, constant real vertical clearance, yaw-only angular chord. V3 correctly reports null. On this CPU, with yaw change.03rad: .01m vertical gap ~1.3ms/query; .001m ~5.5ms; .0001m ~55ms. The global rotational bound is conservative even when the Y separating axis is actually invariant, causing many temporal fallback subdivisions. Useful follow-up optimization: exact rejection on a provably invariant/common separating axis; do not introduce a larger protective box or discard an uncertified collision.

`candidate-v3-near-roof-performance.mjs` and `.log` capture this bounded benchmark. This is not a false-contact correctness failure.

## Final V4 verification — completed 17:12 UTC

Final frozen source SHA256 **`5a6cb584df1a0d3ed0cb181e53808413fe73f4fe2c7af228a6144473ebb76cf5`**, saved as `candidate-v4-5a6cb584-physics-main.js`. Adds Euler-order-correct directional angular projection bounds; does not weaken contact geometry.

**All nine original flat/slope/bridge production-motion regressions now completed and passed on this exact final source: 30/60/144 Hz.** True head-on still dies45.3571G at each rate. Straight3.5m lane meeting and real bridge-over-bypass crossing survive at each rate. Full-motion gap minima:

| Hz | Flat gap | Slope gap | Bridge gap |
|---:|---:|---:|---:|
|30|1.635591m|.738611m|1.996428m|
|60|1.664968m|.767853m|2.025889m|
|144|1.681937m|.784638m|2.042885m|

The incomplete V3 resource-pressure144 attempt is superseded, not erased. Per user retry cadence, a single-process retry was started after17:12; before retry the absence of a completed V4 144 output was checked. It completed successfully. Old logs and versioned sources/results remain separate.

Final V4 shallow/contact/rotation tests also passed:

- All16 constant-orientation shallow swept contacts detected.
- Actual production horizontal and PI/2-pitch moving sweeps: shallow-clear vx-3 has0 contact/hull100; real vx-9 /vx-18 contacts deliver5.2544G /10.5075G and correct nonfatal damage. High-pitch positive cases collide mid-chord although already clear at frame end.
- Scripted pitch/yaw/roll rotation-only actual-contact and clear controls retain correct behavior, including angular-normal damage rather than total angular speed.
-100 seeded rotating response trials: no residual-overlap warnings, including prior fuzz35.
- Actual production keyboard continuous yaw/pitch positives contact and stay physically separated after response(minimum gap.0001m), while clear yaw/pitch controls have0 contacts/hull100. Roll clear cases remain clear.
- Roof-clearance performance hotspot fixed: pure yaw.03rad with native vertical gap.0001m correctly returns null in ~.31ms(query after caches), down fromV3 ~55ms; gap.001m ~.28ms. Initial first query includes bounds-cache initialization(~6ms).

Final artifacts use `candidate-v4-*` and `*-v4.mjs` names, particularly `candidate-v4-results.{30,60,144}.json`, `candidate-v4-angular.log`, `candidate-v4-angular-response.json`, `candidate-v4-production-rotation.json`, and `candidate-v4-near-roof-performance.log`. Earlier sections intentionally retain the historical findings against V1/V2/V3, not unresolved blockers against V4.

**Reviewer disposition: no remaining correctness blocker found within this coast traffic-contact audit.** This is CPU-only production-motion/native-geometry evidence, not GPU visual gameplay certification or deployment authorization.
