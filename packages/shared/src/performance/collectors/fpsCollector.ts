/**
 * FPS Collector
 *
 * Measures frame rate using requestAnimationFrame.
 * Works on Web, Desktop (renderer), and React Native.
 */

let animationFrameId: number | null = null;
let isRunning = false;

// FPS calculation state
let lastTime = 0;
let frameCount = 0;
let lastReportTime = 0;
const REPORT_INTERVAL_MS = 100; // Report every 100ms

function getNow() {
  if (
    typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
  ) {
    return performance.now();
  }
  return Date.now();
}

/**
 * Start FPS collection
 */
export function startFPSCollection() {
  if (isRunning) {
    return; // Already running
  }

  if (typeof requestAnimationFrame === 'undefined') {
    // eslint-disable-next-line no-console
    console.warn('[FPSCollector] requestAnimationFrame not available');
    return;
  }

  isRunning = true;
  lastTime = getNow();
  lastReportTime = lastTime;
  frameCount = 0;

  function tick() {
    if (!isRunning) return;

    const now = getNow();
    frameCount++;

    // Report FPS every REPORT_INTERVAL_MS
    if (now - lastReportTime >= REPORT_INTERVAL_MS) {
      const elapsed = now - lastReportTime;
      const fps = Math.round((frameCount * 1000) / elapsed);

      const g = globalThis as any;
      if (typeof g.__perfReportFPS === 'function') {
        g.__perfReportFPS({
          fps,
          dropped: Math.max(0, 60 - fps), // Assuming 60fps target
        });
      }

      frameCount = 0;
      lastReportTime = now;
    }

    animationFrameId = requestAnimationFrame(tick);
  }

  animationFrameId = requestAnimationFrame(tick);
}

/**
 * Stop FPS collection
 */
export function stopFPSCollection() {
  isRunning = false;
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

/**
 * Get current FPS (one-time measurement)
 * Returns a promise that resolves after measuring for 1 second
 */
export function measureFPS(): Promise<number> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'undefined') {
      resolve(0);
      return;
    }

    let frames = 0;
    const startTime = getNow();
    let rafId: number;

    function count() {
      frames++;
      const elapsed = getNow() - startTime;

      if (elapsed < 1000) {
        rafId = requestAnimationFrame(count);
      } else {
        const fps = Math.round((frames * 1000) / elapsed);
        resolve(fps);
      }
    }

    rafId = requestAnimationFrame(count);
  });
}

export default {
  startFPSCollection,
  stopFPSCollection,
  measureFPS,
};
