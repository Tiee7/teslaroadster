# Finite coastal bridge-bottom contact

Preview-only successor to `ac55a1fc8fcd80fe04d594d8cce58006f1fa8fc5` on PR20.
The original coastal screenshot remains unlocalized; this independently proved
interior-bottom defect does not identify that event or prove every map gap fixed.

## Reproduced, not inferred from the old root-height proxy

At route0 station3800 the unchanged rendered slab contains actual Float32 bottom
triangles. With native r128 geometry/Raycaster, the old fixed `rootY+1.25` ceiling
misses a nose-up car: a visible original vertex crosses real face654 at
30/60/144Hz without damage. Conversely, an inverted airborne car receives old
ceiling damage while all79257 original visible vertices remain at least1.17m
below the actual bottom and its rotated native Box3 intersects no deck triangle.

A stronger continuous witness starts once on actual independently raycast bank
terrain under the bridge (Y0), then uses only Space[0,6.5) and KeyI[3.3,6.5).
All three frame rates enter the real finite bottom with hull100 and no earlier
contact. No repeated pose forcing, player teleport, asset resize or clipped deck
is involved. This is not a complete drive from default spawn. Compact exact
poses/keys/native vertices/face correspondence are in
`baseline-bottom-reproduction.json`; four bounded ac55 assertions are truly red.

## Minimal response and exact boundaries

- Cache602 finite original bottom triangles lazily from the301 nonshared bridge
  segments; use the existing full YXZ vehicle-body SAT/rotating CCD, not an
  infinite-height wall or a root-height box. Side CCD retains its full eager
  oracle and58 unchanged case bodies.
- Compare earliest actual side/bottom/rail/pier/abutment contacts in the existing
  early translation and late paid-RCS phases. No integration/fuel timing moves.
  Bottom response uses original impact/cooldown rules and cancels flight-height
  hold like the old ceiling; multiple contact callbacks are not duplicate hull
  rewards or multiple effective damage events.
- Opt only the player out of the obsolete fixed-height network ceiling. The
  default three-argument network API retains its old ceiling behavior exactly.
  All remaining network geometry/math is byte-identical after three explicit
  syntax inversions; all noncoast physics and frozen assets remain exact.
- A whole-path plane-separation certificate uses projected translation plus
  full-root rotation radius times summed Euler travel. It is not endpoint-only
  or sampled. Its only source delta from a frozen unpruned finite-triangle
  oracle is guarded;121 complete result rows match, including320m cross-grid,
  intermediate pi rotation,0.2mm and0.2micrometre contacts.

## Verification and cost

30 new contact cases (29 native geometry/actual-frame cases and1 CPU oracle
comparison),5 new source/negative guards;43 total inherited/current source guards.
Final joint applicable coverage is1354 unique passes:1299 main,18 serial
terrain,37 serial art,0 skips. Original terrain worker was killed; only two
scheduling lines were changed to yield between fresh-VM stations, then all18
original assertions passed. This is not one clean original batch.
Read `regression-summary.json` for terminal results and the exact inverse proof.
Twelve unchanged expensive highway-planner files reuse the explicitly retained
combined baseline; this is not a fresh full-repository `npm test`. Focused runs
overlap the main batch and are never added to its count. Original failure logs
and test-oracle corrections remain recorded in `preserved-red-history.json`.

One persistent VM per trial uses the original body, actual keys,300 warm-up plus
1200 measured real60Hz motion frames,3 trials for each idle/drive scenario. Every
complete state at all1500 frames is byte-identical across ac55/unpruned/final.
Median motion mean in ms: idle .1643 /1.4063 /.2731; drive .1843 /1.1957 /.3268.
The safe certificate avoids the unshipped naive new-query cost; the final fix
still costs more CPU than ac55. This is not a GPU/FPS claim.

Bottom cache:45 grid cells,913 index references,11 idle or197 driven finite
triangles allocated lazily in these runs. These are cardinalities, not heap bytes.
Cold first motion step median in ms, ac55/final: idle6.343/10.415, drive7.041/8.994.
The unchanged internal network gzip budget is9728B; current Node-default gzip is
9609B. No art or size guard was raised for this iteration. Full rows and source
identities are in `performance-baseline.json`; rerun `benchmark.mjs` if needed.

Native r128 fixture SHA256: `9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2`.
Provide that exact original runtime through `ROADSTER_THREE_RUNTIME` (or the
existing `/tmp/roadster-three.min.js` cache). Run tests with
`ROADSTER_REQUIRE_NATIVE_THREE=1`; no missing-runtime skips are accepted locally.

No browser GPU/pixel visibility or user device was tested this round. Actual
native geometry is stronger than two shared height-function mocks, but not a
claim that a person has seen every correct pixel. Bridge top landing and
underpass clear trajectories retain their complete baseline states.
