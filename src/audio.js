// =========================================================================
// 2. MULTI-LAYER SYNTHESIZED WEB AUDIO & COCKPIT VOICE ALERT ENGINE
//    (Thrusters, Motor, Tire Screech, Sonic Boom, Thunder & Female Voice HUD)
// =========================================================================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.thrusterGain = null;
    this.engineOsc = null;
    this.engineGain = null;
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

      // 2. Plaid Tri-Motor High-Frequency Turbine Hum
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const engFilter = this.ctx.createBiquadFilter();
      engFilter.type = 'lowpass';
      engFilter.frequency.value = 260;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;

      this.engineOsc.connect(engFilter);
      engFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start(0);

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

  update(speedRatio, isThrusting, isAttitudeFiring, isDestroyed, tireScreechIntensity = 0.0) {
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

    const motorFreq = 50 + speedRatio * 210 + (isThrusting ? 85 : 0);
    this.engineOsc.frequency.setTargetAtTime(motorFreq, now, 0.05);
    this.engineGain.gain.setTargetAtTime(0.03 + speedRatio * 0.055, now, 0.05);

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
