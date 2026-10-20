# V8 sound and cold-gas pressure release candidate — 2026-10-20

## Authorized scope

- Original, procedural V8-inspired engine voice with speed/analog-load response,
  persistent engine on/off preference and separate BGM/rocket controls.
- Stronger cold-gas pressure wake and slightly more visible brief condensation:
  unchanged nozzle mouths, physical input/gas behavior and0.8-second expiry.
- Preserve the current integrated continuous demo controller 3cd0dca7. No failed
  rolling or tactical prototype is promoted. No V12 selector is included.

The user explicitly accepted proceeding after full regression passes without
waiting for cloud-browser appearance/listening acceptance. The existing0dbe
production page itself cannot create a Three WebGL context in the supported
own-cloud browser; one ordinary reload confirms this capability limit.
`browser-limit.json` records the exact scope. No GPU/security change, denied local
browser retry, user computer or saved environment was used.

This is not an all-mode 60-second collision-free autopilot acceptance. The current
integrated driver retains its known high-density failures. CPU waveform/mesh
checks are not real hearing, shader/blending or interactive-FPS verification.

## Fresh checks

- 39 focused engine/music/jet/reference tests pass (`focused-tests.log`).
- 24 real Lua tests pass (`lua-tests.log`).
- 10,368 production Three r128 nozzle rays, zero body intersections; jet direction,
  condensation lifetime/alignment and FPV behavior pass (`jet-runtime-audit.json`).
- Pressure audit repeats against the frozen before source; physical section and
  gas/visual request updater remain byte-identical to that baseline.
- Exact static projection mirror regenerated through the normal emitter. Hard-
  pinned numerical program cb4aa0c0 and integrated controller 3cd are unchanged;
  full audio/physics source identity now matches (`projection-reconciliation.json`).
- Deterministic bundler, syntax/check and build pass. Full unchanged serial regression passes561/561 with no failures, skips or
  cancellations (973.989seconds). Both current-source identity checks also pass:
  29 static identity/build cases and3 production mirror cases.

The preserved first default-parallel test run ended 498 pass / 5 file-level failures
(`all-tests.log`); its reporter supplied no specific failure reason. This is not
silently relabeled as a pass. The full unchanged suite was rerun serially
using the project's documented low-concurrency route. No assertion, fixture,
frame duration or test case was removed or weakened for this attempt.

## Reproduce

```sh
ROADSTER_THREE_RUNTIME=/tmp/roadster-three.min.js \
  node --test --test-concurrency=1 --test-reporter=tap tests/*.test.mjs
python3 tests/lua_runtime.py
node verification/demo-continuous/emit-browser-static-projection.mjs --check
node verification/demo-continuous/test-static-projection-identity-only.mjs
node --test verification/demo-continuous/test-src-projection-mirror-identity-only.mjs
python3 bundle_app.py
npm run check && npm run build
```

The optional Three cache is the existing official r128 UMD build with SHA256
9274bbcec8d96168626c732b5d31c775aa8cfb7eaa0599bec0c175908a2c1ce2.
Raw driving experiments and their failed prototypes remain local and excluded
from the explicit release-file whitelist. The source is approved for publication; deployment/commit identifiers are recorded
locally after the immutable candidate is committed, not invented in advance.

The exact identity-only declaration mirror intentionally preserves two trailing-
whitespace lines inherited from the original full function source. Other staged
changes pass whitespace checks. Trimming this byte-pinned source copy would
break its identity contract; the two lines are disclosed, not silently ignored.
