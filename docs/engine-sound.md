# Original V8-inspired EV sound

The simulated-engine toggle now gates an original, procedural Web Audio voice inspired by a cross-plane V8. It is an optional EV sound effect, not a recording or a claim about the real Tesla powertrain.

## Sound design

- Two coherent exhaust banks use different four-pulse patterns across a 720-degree virtual crank cycle. Eight combined firing events and unequal bank spacing produce the low pulse/burble rather than a continuous electric sine hum.
- A crank-order sine bass and filtered broadband air add body and load-dependent exhaust texture.
- Speed and the actual analog drive input set continuous virtual RPM, brightness and level. Releasing the throttle gives a quieter, darker coast. There are no simulated gearbox shifts.
- No downloaded samples, external audio requests, new packages or audio licensing dependencies are used.

## Controls and limits

The existing persistent simulated-engine setting and settings labels are unchanged. Only this engine voice passes through its gate; BGM, rocket effects, tires, alerts and voice keep their existing controls. The global SFX mute and destruction state silence the engine. A parked EV with no drive input is silent. Held drive input can produce a restrained stationary rev.

AudioContext initialization and the existing driving/user-gesture path are unchanged. Settings alone do not create or resume an audio context. The engine begins at zero gain; pitch, filter, load, level and toggle changes are smoothed. A bounded soft-clip curve precedes an engine gain of at most 0.084. This is a digital-level safeguard for the new engine voice, not a guarantee about speaker/headphone volume or the peak of all simultaneously mixed SFX.

`SoundEngine.update` accepts optional sixth argument `engineLoad` (0–1). The production physics call passes `Math.max(driveInput.throttle, driveInput.boost, driveInput.reverse)`. Existing five-argument callers retain speed-dependent feedback.

## Reproduce the checks

```
node --test tests/engine-sound.test.mjs tests/engine-sound-render.test.mjs tests/music.test.mjs
node scripts/render-engine-sound-preview.mjs
```

The second command creates a 12-second mono WAV and JSON audit under `verification/engine-sound-preview/`. The sequence is parked silence, low-load movement, rising-speed acceleration, coast, engine-toggle mute/restart, destruction mute and recovery. It exercises the production waveform coefficients, graph parameters and automation in a deterministic CPU reference renderer.

The CPU renderer uses normalized 4096-point periodic tables, RBJ filters and the production soft-clip curve. Browser oscillator interpolation and 2x WaveShaper oversampling can differ. Its audit is explicitly not a native OfflineAudioContext test, subjective listening test, speaker-volume assessment, real-browser autoplay test or WebGL driving test.

Native browser offline rendering was not verified in the current environment: local Chromium launch was blocked, its escalation path failed, and the supported cloud browser rejected the file URL protocol. No bypass was attempted. A real-device listening review remains necessary before describing the sound as perceptually verified.
