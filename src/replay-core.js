// Ephemeral trajectory buffer. No DOM, storage, networking, physics or timers.
// Callers own the scene; samples are copied and retained only until clear().
const RoadsterReplayCore = (() => {
  const STRIDE = 18;
  function create(options = {}) {
    const maxSeconds = options.maxSeconds ?? 300, maxBytes = options.maxBytes ?? 32 * 1024 * 1024;
    let frames = [], bytes = 0, reason = '', stopped = false;
    function append(time, values) {
      if (stopped || !Number.isFinite(time) || time < 0 || values.length % STRIDE) return false;
      if (frames.length && time <= frames[frames.length - 1].time) return false;
      const size = values.length * 4 + 64;
      if (time > maxSeconds + 1e-8 || bytes + size > maxBytes) {
        reason = time > maxSeconds + 1e-8 ? 'duration' : 'memory'; stopped = true; return false;
      }
      frames.push({ time, values: new Float32Array(values) }); bytes += size;
      if (time >= maxSeconds - 1e-8) { stopped = true; reason = 'duration'; }
      return true;
    }
    function reserve(size) {
      if (!Number.isSafeInteger(size) || size < 0 || bytes + size > maxBytes) { stopped = true; reason = 'memory'; return false; }
      bytes += size; return true;
    }
    function at(time) {
      if (!frames.length) return null;
      const t = Math.max(0, Math.min(duration(), Number.isFinite(time) ? time : 0));
      let lo = 0, hi = frames.length - 1;
      while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (frames[mid].time <= t) lo = mid; else hi = mid - 1; }
      const a = frames[lo], b = frames[Math.min(lo + 1, frames.length - 1)];
      return { a, b, alpha: b.time > a.time ? (t - a.time) / (b.time - a.time) : 0, time: t };
    }
    function duration() { return frames.length ? frames[frames.length - 1].time : 0; }
    function clear() { frames = []; bytes = 0; reason = ''; stopped = false; }
    return Object.freeze({ append, reserve, at, clear, duration,
      stats: () => ({ frames: frames.length, bytes, reason, stopped, duration: duration(), maxSeconds, maxBytes }) });
  }
  // Generation/visibility changes and teleports are cuts, never flying cars.
  function continuous(a, b, offset) {
    if (!a || !b || offset + STRIDE > a.length || offset + STRIDE > b.length) return false;
    return a[offset + 16] === b[offset + 16] && a[offset + 10] === b[offset + 10] &&
      Math.hypot(b[offset] - a[offset], b[offset + 1] - a[offset + 1], b[offset + 2] - a[offset + 2]) < 40;
  }
  return Object.freeze({ STRIDE, create, continuous });
})();
