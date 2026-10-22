# Uncommitted city wrap candidate review (17:00 UTC)

Final repeatable candidate snapshot SHA256: `861d687faf1078dda1ba7fb37520bc7b8cf53a800cbf7a91ceeeb80993e6ae84` (`candidate-physics-861d687faf10.js`). All candidate review scripts ending `-snapshot.mjs` now read this immutable file, not the changing working tree. The prior queue run observed `1cf6c0a6...`; the results below were rerun on the immutable final snapshot with the same city outcomes.
Baseline remains git `13b9f5372034cd6ba3e14144433792c525989f63`.
No repo writes/check/build/deployment occurred.

## Passed

- Baseline two models × four seam directions:8/8 immediate lethal wrap witnesses.
- Candidate:8/8 same wrap witnesses no impact/death, without globally suppressing collision.
- Candidate:8/8 existing genuine nearby NPC contacts remain lethal28G.
- Candidate:8/8 hidden-NPC controls remain unharmed.
- Four direction queues:blocked player60 ticks;then visible NPC at target60 ticks;vehicle stays visible and stopped at the original seam throughout. Clearing both obstructions resumes the pending target, restores exact originalvx/vz/speed12 and heading, and next tick advances0.2m normally.4/4 passed.
- `src/vehicles.js` is byte-identical to baseline. Both NS `x=roadCoord+laneOffset` and EW `z=roadCoord-laneOffset` right-hand rules remain unchanged.

Evidence:`candidate-wrap-matrix-results.json`,`candidate-wrap-queue-results.json`.

## Actual geometric edge limitation (not a new fatal witness)

The candidate's `playerClear` ignores the player whenever abs(rootY-npcRootY)>3. A pitched/rolled player's body may extend below that root by over2m.

Reproducer using both real reference/classic native player models:

- Player start x=-1193,z=-6,y=3.01,pitch=π/2,yaw=-π/2,vx=200/3.6, altitude hold3.01.
- NPC start x=1189.95,z=-6,y0,yaw=-π/2,vx12.
- After1/60s NPC wraps to-1190 because3.01>3.
- Real native OBB `cityContactInterval(cityPlayerBody(state),cityTrafficBody(npc)) !== null`:true for both models.
- No damage is emitted because the preexisting traffic response selects branches by root-derived clearanceY and ignores this high-root/low-tail overlap. Thus this test is **not** another lethal counterexample, but the new seam placement still fails its “never teleport a solid vehicle into the player” intent in this orientation.

Suggested narrow correction:use actual oriented body worldY ranges (`body.y±body.ry`) rather than root3m separation for the vertical exemption;keep conservative horizontal reaction distance. The20m other-NPC rule has a similar fixed-root shortcut, although normal non-blasted city NPCs are level atground and this review did not establish a car-to-car failure from it.

Evidence:`candidate-wrap-pitched-overlap.mjs`,`candidate-wrap-pitched-overlap-results.json`.

## Revised candidate verified (17:03 UTC)

Immutable SHA256: `568608124933aa48e2de6995dca63556ca1c929c03089025e754e1d0a5a7be7a`; source `candidate-physics-568608124933.js`. The writer replaced the fixed3m root shortcut with actual oriented body vertical ranges and2m separation margin. Repeated24 old witnesses/controls retain the same correct outcomes, all4 queue/resume cases still pass, and both pitched overlap reproducers now remain at the old seam with no solid overlap/no damage. The earlier geometric limitation is resolved in this revised candidate. All `*-snapshot.mjs` scripts are now pinned to this exact immutable revised snapshot.
