# V8 control lifecycle and high-speed register

Base: production main `3db131b8d754870b40008e927a84a376b3327e82`.

The first separate commit fixes city render/audio ownership and no-RAF pause
muting. The next targeted sound change addresses the user's clarified high-speed
whine, not a replacement engine: the original two-bank waveform function retains
SHA256 `eff5640ecbfa2ebb1ee925003968d0fe863ad068395107ad3aaf69ed80f270d9`.

Before, `speed / maxSpeed` let a 200/370 performance-cap change alter virtual
revs at constant road speed. Both city and legacy call sites now use a fixed
200 km/h reference. The original RPM mapping is unchanged below 3200 RPM; a
continuous first-derivative knee approaches 4100 above it. The existing 1.5
normalized-speed clamp means pitch plateaus from approximately 300 km/h.
Low-pass cap is 1450 Hz (previously 2200), full-load texture gain .093 (.123),
and bass gain .30 (.26). Original automation time constants, V8 pulse banks,
soft peak limiter, saved settings, and cold-gas thruster graph are retained.
Low-speed filter/bass weighting is also adjusted; it is not byte-identical audio.

Deterministic **engine-only CPU reference**, after settling, 370 km/h with W held
after boost release: virtual RPM 6450 → 4075.7, spectral centroid 321 → 178.8 Hz,
power above 1 kHz 5.74% → 1.56%, RMS .0278 → .0303. These characterize a darker
signal without simply turning it down; they are not subjective listening proof.
The unchanged rocket noise is not included in these comparison WAVs.

Reproduce:
```
node scripts/audit-high-speed-engine.mjs /tmp/v8-comparison
python3 verification/v8-high-speed/analyze.py /tmp/v8-comparison
node --test tests/city-sound.test.mjs tests/engine-high-speed.test.mjs tests/engine-sound*.test.mjs
```

Before/after WAVs were saved outside the repo at
`/workspace/shared/map2-v8-high-speed-20261021/`; committed JSON records the audit.
Native OfflineAudioContext rendering and subjective/device listening are **not
verified**. The supported cloud browser's read-only evaluator exposed neither
`OfflineAudioContext` nor `webkitOfflineAudioContext` (03:33 UTC); this does not
prove that the browser itself lacks the API. No unsafe script injection or local
Chromium security-workaround retry was attempted. No WebGL/phone FPS claim.

`numerical-epoch-proof.json` records identical full numeric program SHA256 before
and after. Source identity manifests were regenerated explicitly, not bypassed.
