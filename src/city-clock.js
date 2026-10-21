// City manual driving uses simulation time, not the number of rendered frames.
// A bounded 60 Hz physics tick preserves all ordinary foreground elapsed time.
const RoadsterCityClock = (() => {
  const STEP_SECONDS = 1 / 60;
  const SUSPEND_SECONDS = 1;
  function createClock() {
    let accumulator = 0, steps = 0, simulatedSeconds = 0;
    const clear = () => { accumulator = 0; };
    function advance(seconds, step, active = () => true) {
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > SUSPEND_SECONDS || !active()) {
        clear();
        return { frameSteps: 0, suspended: true, accumulator };
      }
      accumulator += seconds;
      let frameSteps = 0;
      const presentationSeconds = Math.floor((accumulator + 1e-10) / STEP_SECONDS) * STEP_SECONDS;
      // No coarse Euler step and no discarded 50–100 ms remainder. A >1 s
      // suspended frame is a pause, never an unbounded burst of catch-up work.
      while (accumulator + 1e-10 >= STEP_SECONDS && active()) {
        accumulator = Math.max(0, accumulator - STEP_SECONDS);
        step(STEP_SECONDS, accumulator + 1e-10 < STEP_SECONDS ? presentationSeconds : null);
        frameSteps++; steps++; simulatedSeconds += STEP_SECONDS;
      }
      if (!active()) clear();
      return { frameSteps, suspended: false, accumulator };
    }
    return Object.freeze({ advance, clear, stats: () => ({ accumulator, steps, simulatedSeconds }) });
  }
  return Object.freeze({ STEP_SECONDS, SUSPEND_SECONDS, createClock });
})();
