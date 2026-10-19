# NPC models + traffic/distance scoring: local serial integration

Inputs retained on their own branches:

- NPC compact candidate: `4141bf0c0093aad5227efba9f41e87963d772ef3`.
- Traffic/scoring: `631dd07312db1abed968df66ac77f8fa3bb1af47`.
- Base release, including the live cockpit-screen fix: `683f6fd15331d619866b8433520b25d36a75d216`.

The integration branch first layers the traffic/scoring commit after NPC. The two
text conflicts were the bundler's module list and the taxi frame-sequence test;
both feature sets are retained. Source HTML merged cleanly and index.html was
regenerated from source. No player visual candidate is included.

NPC fixtures and exact-r128 validation now load the production highway module
and production lane/scale constants, so validation exercises the combined runtime.
Three extra actual-factory scenes cover 20/36/52 pools for ten seconds at 30 Hz,
including weighted speed targets, stable model/source/driver identity, active pair
separation, hidden waiting-spawn placeholders and the eight-near-car LOD cap.

Legacy source geometry hashes are now content-stable: positions, topology and pose
are canonicalized without random Three.js UUIDs or material identifiers. Two full
independent generations are byte-identical. Every packed geometry record remains
byte-identical to the CPU-reviewed NPC candidate; only legacy fingerprint metadata
changed. The existing 90 actual CPU views retain their original provenance, with
explicit per-style geometry-equivalence proofs.

Final local verification:

- 370 Node tests passed, zero failures.
- 24 Lua tests passed.
- Deterministic bundle/syntax/deployment checks and static build passed.
- Actual Three.js r128: all 15 styles × 2 LODs, zero normal-winding disagreements or
 rear occlusion misses; 60 repopulations remain bounded to 85 geometries / 14 materials.
- Original NPC factory, player exterior/cockpit, mobile/audio and all pre-population
 vehicle geometry remain unchanged, as recorded in integration-preservation.json.

This is local validation. No remote branch, main ref or deployment was changed by
this task. Original model archive publication remains separately pending approval;
the complete ZIP, manifest and two verified binary transport parts are retained
locally. The prior whole-ZIP upload returned HTTP 400 for exceeding the 16 MiB request
limit and supplied no blob SHA. No upload workaround or remote retry was attempted
while approval was pending.
