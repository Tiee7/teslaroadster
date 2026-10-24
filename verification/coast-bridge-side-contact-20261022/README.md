# Coastal finite bridge-side contact

Preview-only successor to `9414c67d4706902c8b723a2b1f33fdb6e17262a9` on PR20.
The original coastal screenshot's pixels/location remain unavailable; this does
**not** identify that user event or prove every bridge/ground gap resolved.

## Reproduced defect

The deck renderer contains real finite sloped side quads, but the old collision
path handled rails, piers, abutments and a root-height underside test, not those
side faces. At30/60/144Hz, on both sides, actual visible reference-car vertices
enter the original Float32 slab without any real damage callback. Native r128
Raycaster confirms lateral triangles657/659 with normalY=0. Continuations retain
zero damage while penetration reaches roughly9.8–12.2cm, not just first contact.

A second, stronger witness starts once on actual nearby terrain: route0 station
4600,40m beyond one bridge edge,15m/s. Native rendered terrain-triangle raycasting
independently verifies support. Hold Space[0,1.6), W[0,2), then release, without
per-frame state assignments. At60Hz, the original visible vertex crosses actual
side triangle1527 at1.7s,32.03mm inside, hull100 and no earlier damage. Equivalent
30/144Hz replays reproduce a strict side crossing too. This is **not** a complete
route from default spawn. See the compact `baseline-side-reproduction.json` and
portable test; complete bounded-search logs are retained outside the repository.

## Limited repair

- Read and lazily spatially cache the original rendered bridge rows and exact
  Float32 slab depth. SAT uses the real finite quad and existing full-YXZ
  `cityPlayerBody` model-bounds proxy, not a resized model or detailed mesh solver.
  No min/maxY rectangular wall, infinite extension or invented end cap is added.
- Constant attitude has exact linear interval TOI. Rotation uses conservative
  advance and fixed-axis interval certificates; exhausting iterations never means
  clear. Its velocity bound uses the world YXZ rotation axes against the current
  separating axis, including their possible movement over that interval.
- Compare with the earliest original structure at the existing phase; ties keep
  the old winner. Also cover later paid yaw/pitch/roll RCS and compare the old
  pier-yaw candidate before responding. After an earlier pier, check only the
  remaining pitch/roll path. Never rerun fuel or time integration.
- Use signed normal translation/angular closing, original1.25 normal response,
  unchanged damage law, TOI attitude and0.1mm local separation. Opening/resting
  overlap must not generate minimum damage. Finite top/bottom shared edges are
  real geometry; ordinary interior top/bottom and bridge-underpass code stays
  unchanged. The exact old station4300 bottom-first witness is now stopped by a
  real shared lower side edge; this is not a general underside-solver repair.
- Terrain/network/renderer, models/materials/scales, driving constants, weather,
  lamps, single-passenger flow, NPCs and highway recycling are byte frozen.

## Cache/broadphase cost checked before release

The correct finite-side candidate initially built602 quad objects per VM and
performed many far-face SAT checks. Three persistent-VM trials per route use
300 warmup+1200 measured actual numerical-motion steps, one native supported
initialization and only real digital controls. Every state on all1500 frames is
byte-identical across9414/eager/repaired variants. On bridge driving, mean physics
CPU is0.130ms for9414 (which lacks side collision),4.569ms for the unshipped eager
candidate,0.197ms repaired; side query2.196→0.031ms. Initial-query median4.961→2.161ms.

The repair indexes45 cells/672 numeric edge references and builds exact geometry
only after the conservative full root-centred rotation radius intersects the
finite face bounds (0 quads on these centre-lane routes, rather than602). It
checks the whole translation chord and rotation envelope, not endpoint OBBs.
An exact archived eager-query oracle verifies every result field across real
faces, rotating intermediate protrusions, cross-cell/high-speed and tiny chords.

This removes the **new candidate's** overhead; repaired CPU is not claimed faster
than old9414, nor is physics-only CPU equivalent to whole-game FPS/GPU. See
`performance-baseline.json`. Reproduce with a local official Three r128 runtime:
`ROADSTER_THREE_RUNTIME=/path/three-r128.min.js node verification/coast-bridge-side-contact-20261022/benchmark.mjs /tmp/bridge-side-performance.json`.

## Regression evidence and cost

The new63 unique cases comprise58 contact/oracle/ordering cases and5 source-scope
negative guards. They include actual visible geometry before **and on** the first
resolved contact row, true nearby-ground continuous inputs, independent native
Box3-vs-original-triangle TOI, full YXZ/short arcs,30/60/144 partitions, finite
ends and upper/lower edges,0.2mm low-speed travel, shallow overlaps/opening,
9 paid RCS cases, and6 explicitly controlled candidate-adapter order/tie cases
(not six additional full-map simultaneous-contact demonstrations).

The first oracle draft incorrectly included hidden/shadow geometry; its failure
log is retained, then the independent visible-bounds oracle was corrected.
A real intermediate production-plane gate failure was also retained: tilted
corners had crossed the infinite plane before reaching the finite panel, causing
28–61mm late partition contacts. Removing that invalid gate restores finite
triangle TOI, including0.2mm steps; no tolerance was loosened.

A no-contact0.2-micrometre gap with pitch about the face normal exposed a new
prototype subdivision path exceeding a5-second process limit. The conservative
axis-aware bound returns correct null in1.68ms on the same CPU fixture; the final
regression also checks null without a brittle wall-clock gate. This is a narrow
algorithm safety/cost result, **not** an FPS or GPU performance claim. The game
payload grows22,458 raw bytes/6,240 gzip-9 bytes; original art/road budgets remain
unchanged. Exact applicable results and preserved earlier red evidence are
recorded in `regression-summary.json`; the earlier unexplained parallel terrain
SIGKILL and same-byte serial18/18 are retained in `preserved-red-history.json`.

CPU production motion/damage plus original native Three r128 geometry is not
browser pixels, shader validation or user-device GPU acceptance. Destruction
presentation is stubbed; no simulation continues past the first callback.

The exact9414 physics oracle retains two original trailing-space lines. A single
path-specific Git whitespace attribute preserves those historical bytes; strict
fixture SHA256 guards still reject any drift and live source checks stay default.
