// =========================================================================
// 2. MULTI-LAYER SYNTHESIZED WEB AUDIO & COCKPIT VOICE ALERT ENGINE
//    (Thrusters, Motor, Tire Screech, Sonic Boom, Thunder & Female Voice HUD)
// =========================================================================
// Original, sample-free cross-plane V8-inspired sound for the EV simulation.
// Each bank fires four times per 720-degree cycle. Uneven bank spacing and
// slightly different pulse strengths create a low exhaust burble, while the
// combined eight events retain a coherent RPM-linked firing order.
function createRoadsterV8Wave(ctx, bank) {
  const firingSlots = bank === 0 ? [0, 3, 5, 6] : [1, 2, 4, 7];
  const strengths = bank === 0 ? [1, 0.86, 1.04, 0.93] : [0.92, 1.02, 0.88, 1];
  const real = new Float32Array(97);
  const imag = new Float32Array(97);
  for (let harmonic = 1; harmonic < real.length; harmonic++) {
    // Rounded pressure pulses: no DC, sawtooth ramp, or hard-edged square wave.
    const decay = 1 / Math.pow(1 + Math.pow(harmonic / 18, 2), 0.85);
    const pulsePhase = -Math.atan(harmonic * 0.11);
    for (let event = 0; event < firingSlots.length; event++) {
      const phase = -2 * Math.PI * harmonic * (firingSlots[event] / 8 + bank * 0.006) + pulsePhase;
      real[harmonic] += Math.cos(phase) * strengths[event] * decay / 4;
      imag[harmonic] += Math.sin(phase) * strengths[event] * decay / 4;
    }
  }
  return ctx.createPeriodicWave(real, imag);
}

function getRoadsterEngineVoice(speedRatio, engineLoad, isThrusting = false) {
  const speed = Math.max(0, Math.min(1.5, Number.isFinite(speedRatio) ? speedRatio : 0));
  // The optional sixth update argument is actual drive input, including analog
  // throttle. Old callers retain useful speed feedback without a new dependency.
  const load = Number.isFinite(engineLoad)
    ? Math.max(0, Math.min(1, engineLoad)) : (isThrusting ? 0.9 : 0.28);
  const activity = Math.max(Math.min(1, speed / 0.045), Number.isFinite(engineLoad) ? load * 0.65 : 0);
  // Keep the original V8 firing order, but run in a quiet low exhaust register.
  // Speed/load no longer sweep several octaves or feed prominent air hiss.
  const rawRpm = 780 + speed * 900 + load * 260;
  const rpm = rawRpm <= 1800 ? rawRpm : 1800 + 500 * (1 - Math.exp(-(rawRpm - 1800) / 500));
  return {
    speed, load, rpm,
    cycleFrequency: rpm / 120,
    cutoff: Math.min(680, 240 + speed * 160 + load * 260),
    gain: activity * (0.016 + Math.min(1, speed) * 0.010 + load * 0.021),
    textureGain: 0.003 + load * 0.010,
    bodyGain: 0.34 + load * 0.12,
    bankGain: 0.38 + load * 0.08,
  };
}

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.thrusterGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineOvertoneOsc = null;
    this.engineFilter = null;
    this.engineOvertoneGain = null;
    this.engineBankGain = null;
    this.engineBodyOsc = null;
    this.engineBodyGain = null;
    this.engineTextureGain = null;
    this.engineTextureFilter = null;
    this.engineSaturator = null;
    this.engineVoice = null;
    this.simulatedEngineGain = null;
    this.simulatedEngineEnabled = true;
    try { this.simulatedEngineEnabled = localStorage.getItem('roadster.engineSound.enabled.v1') !== 'false'; } catch (_) {}
    this.screechOsc = null;
    this.screechGain = null;
    this.screechFilter = null;
    this.noiseBuffer = null;
    this.initialized = false;
    this.lastVoiceTime = {};
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      const bufferSize = this.ctx.sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      // 1. Cold-Gas Supersonic Thruster Roar
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = this.noiseBuffer;
      whiteNoise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1100;
      filter.Q.value = 0.7;

      this.thrusterGain = this.ctx.createGain();
      this.thrusterGain.gain.value = 0.0;

      whiteNoise.connect(filter);
      filter.connect(this.thrusterGain);
      this.thrusterGain.connect(this.ctx.destination);
      whiteNoise.start(0);

      // 2. V8-style EV sound: two irregular exhaust banks, a crank-order
      // bass layer and a restrained, load-sensitive combustion-air texture.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.setPeriodicWave(createRoadsterV8Wave(this.ctx, 0));
      this.engineOsc.frequency.value = 780 / 120;
      this.engineBankGain = this.ctx.createGain();
      this.engineBankGain.gain.value = 0.60;
      this.engineOvertoneOsc = this.ctx.createOscillator();
      this.engineOvertoneOsc.setPeriodicWave(createRoadsterV8Wave(this.ctx, 1));
      this.engineOvertoneOsc.frequency.value = 780 / 120;
      this.engineOvertoneGain = this.ctx.createGain();
      this.engineOvertoneGain.gain.value = 0.44;

      this.engineBodyOsc = this.ctx.createOscillator();
      this.engineBodyOsc.type = 'sine';
      this.engineBodyOsc.frequency.value = 780 / 60;
      this.engineBodyGain = this.ctx.createGain();
      this.engineBodyGain.gain.value = 0.34;

      const engineTexture = this.ctx.createBufferSource();
      engineTexture.buffer = this.noiseBuffer;
      engineTexture.loop = true;
      this.engineTextureFilter = this.ctx.createBiquadFilter();
      this.engineTextureFilter.type = 'bandpass';
      this.engineTextureFilter.frequency.value = 250;
      this.engineTextureFilter.Q.value = 0.65;
      this.engineTextureGain = this.ctx.createGain();
      this.engineTextureGain.gain.value = 0.003;

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 240;
      this.engineFilter.Q.value = 0.55;
      // Soft saturation gives exhaust body and provides a hard digital peak
      // bound for this voice only. Its output is <= 1, then gain stays <= .047.
      this.engineSaturator = this.ctx.createWaveShaper();
      const curve = new Float32Array(2049);
      for (let i = 0; i < curve.length; i++) {
        const x = i * 2 / (curve.length - 1) - 1;
        curve[i] = Math.tanh(x * 1.35) / Math.tanh(1.35);
      }
      this.engineSaturator.curve = curve;
      this.engineSaturator.oversample = '2x';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      // Only the simulated engine passes through this preference gate.
      // Thrusters, tires, alerts and BGM retain their existing controls.
      this.simulatedEngineGain = this.ctx.createGain();
      this.simulatedEngineGain.gain.value = this.simulatedEngineEnabled ? 1 : 0;

      this.engineOsc.connect(this.engineBankGain);
      this.engineBankGain.connect(this.engineFilter);
      this.engineOvertoneOsc.connect(this.engineOvertoneGain);
      this.engineOvertoneGain.connect(this.engineFilter);
      this.engineBodyOsc.connect(this.engineBodyGain);
      this.engineBodyGain.connect(this.engineFilter);
      engineTexture.connect(this.engineTextureFilter);
      this.engineTextureFilter.connect(this.engineTextureGain);
      this.engineTextureGain.connect(this.engineFilter);
      this.engineFilter.connect(this.engineSaturator);
      this.engineSaturator.connect(this.engineGain);
      this.engineGain.connect(this.simulatedEngineGain);
      this.simulatedEngineGain.connect(this.ctx.destination);
      this.engineOsc.start(0);
      this.engineOvertoneOsc.start(0);
      this.engineBodyOsc.start(0);
      engineTexture.start(0);

      // 3. Ground Tire Grip Screech Synthesizer (High-Speed Cornering & Hard Braking)
      this.screechOsc = this.ctx.createOscillator();
      this.screechOsc.type = 'triangle';
      this.screechOsc.frequency.value = 1480;

      const screechNoise = this.ctx.createBufferSource();
      screechNoise.buffer = this.noiseBuffer;
      screechNoise.loop = true;

      this.screechFilter = this.ctx.createBiquadFilter();
      this.screechFilter.type = 'bandpass';
      this.screechFilter.frequency.value = 1650;
      this.screechFilter.Q.value = 4.2;

      this.screechGain = this.ctx.createGain();
      this.screechGain.gain.value = 0.0;

      this.screechOsc.connect(this.screechFilter);
      screechNoise.connect(this.screechFilter);
      this.screechFilter.connect(this.screechGain);
      this.screechGain.connect(this.ctx.destination);
      this.screechOsc.start(0);
      screechNoise.start(0);

      this.initialized = true;
    } catch (e) {}
  }

  setSimulatedEngineEnabled(enabled) {
    this.simulatedEngineEnabled = Boolean(enabled);
    try { localStorage.setItem('roadster.engineSound.enabled.v1', String(this.simulatedEngineEnabled)); } catch (_) {}
    // Settings must work before the first driving gesture without creating or
    // resuming an AudioContext. A short ramp also avoids a pop during driving.
    if (this.simulatedEngineGain && this.ctx) {
      this.simulatedEngineGain.gain.setTargetAtTime(this.simulatedEngineEnabled ? 1 : 0, this.ctx.currentTime, 0.015);
    }
  }

  update(speedRatio, isThrusting, isAttitudeFiring, isDestroyed, tireScreechIntensity = 0.0, engineLoad) {
    if (!this.initialized || !this.ctx) return;
    if (!this.enabled || isDestroyed) {
      this.thrusterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
      if (this.screechGain) this.screechGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
      return;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    const now = this.ctx.currentTime;
    const thrustLevel = (isThrusting ? 0.24 : 0) + (isAttitudeFiring ? 0.09 : 0);
    this.thrusterGain.gain.setTargetAtTime(thrustLevel, now, 0.04);

    // Continuous virtual RPM suits an electric drivetrain: no invented gear
    // shifts, no boost pitch jump. All changes ramp to avoid throttle/toggle pops.
    const voice = getRoadsterEngineVoice(speedRatio, engineLoad, isThrusting);
    this.engineVoice = voice;
    this.engineOsc.frequency.setTargetAtTime(voice.cycleFrequency, now, 0.10);
    this.engineOvertoneOsc.frequency.setTargetAtTime(voice.cycleFrequency, now, 0.10);
    this.engineBodyOsc.frequency.setTargetAtTime(voice.cycleFrequency * 2, now, 0.10);
    this.engineFilter.frequency.setTargetAtTime(voice.cutoff, now, 0.08);
    this.engineTextureFilter.frequency.setTargetAtTime(250 + voice.load * 220 + voice.speed * 70, now, 0.10);
    this.engineTextureGain.gain.setTargetAtTime(voice.textureGain, now, 0.08);
    this.engineBodyGain.gain.setTargetAtTime(voice.bodyGain, now, 0.08);
    this.engineOvertoneGain.gain.setTargetAtTime(voice.bankGain, now, 0.08);
    this.engineGain.gain.setTargetAtTime(voice.gain, now, 0.08);

    if (this.screechGain && this.screechOsc) {
      const clampScreech = Math.min(0.16, Math.max(0.0, tireScreechIntensity * 0.14));
      this.screechGain.gain.setTargetAtTime(clampScreech, now, 0.035);
      this.screechOsc.frequency.setTargetAtTime(1380 + Math.sin(now * 28) * 140 + speedRatio * 220, now, 0.03);
    }
  }

  beep(freq = 660, duration = 0.12) {
    if (!this.initialized || !this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.value = 0.12;
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  playMilestoneChime() {
    if (!this.initialized || !this.enabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(1046.5, now);
      osc1.frequency.setValueAtTime(1318.5, now + 0.08);
      osc1.frequency.setValueAtTime(1567.98, now + 0.16);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2093.0, now);
      osc2.frequency.setValueAtTime(3135.96, now + 0.16);

      gain.gain.setValueAtTime(0.20, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.40);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.42);
      osc2.stop(now + 0.42);
    } catch (e) {}
  }

  playAirBrakeServo() {
    if (!this.initialized || !this.enabled || !this.ctx || !this.noiseBuffer) return;
    try {
      const now = this.ctx.currentTime;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.frequency.exponentialRampToValueAtTime(320, now + 0.28);
      filter.Q.value = 3.2;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 0.35);
    } catch (e) {}
  }

  playSonicBoom() {
    if (!this.initialized || !this.enabled || !this.ctx || !this.noiseBuffer) return;
    try {
      const now = this.ctx.currentTime;
      // Sub-bass N-wave shockwave boom
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(175, now);
      subOsc.frequency.exponentialRampToValueAtTime(22, now + 0.65);
      subGain.gain.setValueAtTime(0.55, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
      subOsc.connect(subGain);
      subGain.connect(this.ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.75);

      // High-velocity shock crack
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(160, now + 0.55);
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.38, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 0.62);
    } catch (e) {}
  }

  playThunder() {
    if (!this.initialized || !this.enabled || !this.ctx || !this.noiseBuffer) return;
    try {
      const now = this.ctx.currentTime;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(280, now);
      filter.frequency.exponentialRampToValueAtTime(45, now + 1.4);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.45);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 1.5);
    } catch (e) {}
  }

  speakAlert(alertKey, textEn, textZh) {
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (this.lastVoiceTime[alertKey] && nowMs - this.lastVoiceTime[alertKey] < 4200) return;
    this.lastVoiceTime[alertKey] = nowMs;

    // Play futuristic dual-tone aerospace cockpit chime
    this.beep(880, 0.08);
    setTimeout(() => this.beep(1174, 0.12), 85);

    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const isZh = (currentLang === 'zh');
        const utter = new SpeechSynthesisUtterance(isZh ? textZh : textEn);
        utter.lang = isZh ? 'zh-CN' : 'en-US';
        utter.pitch = 1.12;
        utter.rate = 1.08;
        utter.volume = 0.85;
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const preferred = voices.find(v =>
            v.lang.toLowerCase().includes(isZh ? 'zh' : 'en') &&
            /female|zira|samantha|google|victoria|ting|xiaoxiao|yaoyao/i.test(v.name)
          ) || voices.find(v => v.lang.toLowerCase().includes(isZh ? 'zh' : 'en'));
          if (preferred) utter.voice = preferred;
        }
        window.speechSynthesis.speak(utter);
      }
    } catch (e) {}
  }

  playCrash(isFatal = false) {
    if (!this.initialized || !this.enabled || !this.ctx || !this.noiseBuffer) return;
    try {
      const now = this.ctx.currentTime;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isFatal ? 950 : 520, now);
      filter.frequency.exponentialRampToValueAtTime(65, now + (isFatal ? 0.85 : 0.3));

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(isFatal ? 0.45 : 0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (isFatal ? 0.9 : 0.32));

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + (isFatal ? 0.92 : 0.35));
    } catch (e) {}
  }
}

const sound = new SoundEngine();
