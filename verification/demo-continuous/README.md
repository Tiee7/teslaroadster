# Continuous multi-lane demo: current evidence

## Audiovisual-release scope update — 2026-10-20

The user prioritized an existing V8-sound/stronger-jet/brief-condensation release
with the current integrated demo, rather than waiting for all-mode60-second
collision-free driving. That changes the release scope, not the failed driving
evidence below. Actual controller remains3cd0dca7; rolling v14/v15 and tactical
experiments are isolated failures and are not promoted. V12 is not implemented.
Current own-cloud browser opens the existing production0dbe page but cannot
initialize its Three WebGL context, including after one ordinary reload. No new
visual, hearing or interactive-FPS pass is claimed. Fresh candidate checks and
the pending release decision are tracked in `../priority-audio-jet-release/`.

## Historical all-mode autopilot release gate (not an audiovisual pass)

Status2026-10-20: NOT RELEASE READY. Actual3cd passes its complete tests and seed7 clock run, but the fixed nine-case matrix has two real collisions (52 cars/seed1 at30.6167s, seed23 at82.2167s). No preview or production publication. Broader matrix and browser acceptance are not passed. Actual controller3cd0dca79b78ae6a7a85bd92443a2340cd9273f02f15e993af5489e9353a466a; official-r128/G/requesting-phase helper69868deb4aed37cc25c78828fdc9ef34eae4ffae217396b965807f7277f3feff; static projectionf9e5783f, unchanged numerical corecb4aa0c0; bundlef28ea00cf4a1f4a0a5551add8275376124b882feae25c1b6935b37507f664e63. Full SHA and source-boundary details are in CURRENT-VALIDATION-STATUS.md.

## Completed actual3cd CPU runs

Same seed7/52 actual cars, normal acceleration from0,90 simulated seconds, production clock/beginRender, shared192 actual-work units and20ms measured deadline/render. All30/60/144Hz runs:0 impacts,31 paid hops,5s-warm minimum227.316203635km/h,220+ share100%, gas minimum2.686121909s,49.7037% air, longest air2.08333s. Sustained airborne forward/lift input requests0; ordinary automatic jump/save lift burns remain real. Each schedule simulates90 seconds without count-budget violations.

| synthetic render schedule | complete CPU render p95/p99/max(ms) | >33.33ms / renders | >50ms |
|---|---|---|---|
|30Hz|23.302 /26.388 /40.606|1 /2700|0|
|60Hz|21.075 /22.399 /32.156|0 /5400|0|
|144Hz|20.124 /21.106 /33.139|0 /12960|0|

These are native CPU numerical-helper timings, not actual browser FPS, GPU throughput or a no-latency guarantee. One indivisible operation/GC can exceed the20ms background deadline. Work unit definition changed from historical96-unit tests and count allowance was increased explicitly.

See production-3cd-full90-{30,60,144}.json. The fixed typed IEEE754 control/physics trace is5d57b8225c430ed81b562a50036d3e3ea92a788c52fc390b248f5ddc1ae05815 in all three actual-source runs. Whole player/NPC/actual emitted controls match across every one of5400 physical frames in the preceding frozen5d09 prototype (raw-clock-object-is-comparison.json); that broader raw equality scope belongs to that prototype, not an unrecorded actual-source raw pass. Raw V8 serialization is not a canonical hash. Background route certificate readiness differs on52/24 prototype frames and is retained as a difference. No state/NPC physical value is filtered from those full comparisons.

## Focused/manual scope

Current source pins:29 static identity tests,3 source-mirror positive/negative tests,16 bridge/certificate cancellation/priority tests and169 old-copy/new-direct comparator cases pass. These are isolated source/dependency checks, not an actual browser pass.

Manual comparison executes actual keys with isActive/isBusy/isRequestingJump allfalse:4,800 ordinary physical frames across40 configurations/52 episodes plus480 ordinary O frames,5,284 whole-state exact comparisons and10,560 input assertions,0 divergences against the frozen old production source using the same corrected helper.34 groups complete continuous120-frame episodes;6 deliberately held-steering groups hit the real rail identically and restart independent episodes. This is equivalence, not a claim those steering inputs drive safely. The final3cd repeat also passes with sources unchanged; see manual-production-3cd-episodes.json.

## Release gates still open

- Completed:555 Node tests,24 Lua tests, check/build;29 static identities,25 kernel/bridge/mirror negatives and169 comparator cases. Pure candidate tests are physical-model units, not autonomous-admission evidence.
- Broader same-seed density/seed measurements and continuous crossing metrics
- Supported own-cloud browser full-physics shadow, ordinary no-shadow90s driving, actual manual/input/exit response and screenshots
- Parent serial publication only after validation; main and current production remain unchanged

Local Chromium startup was denied by execution infrastructure; no browser was launched. Supported cloud CUA cannot reach this execution environment’s localhost address. A single isolated non-production files package is being prepared locally; no external preview has been created. Historical failures and old truncated/mismatched-math helpers are explicitly scoped in CURRENT-VALIDATION-STATUS.md and must not be used as current production acceptance.
