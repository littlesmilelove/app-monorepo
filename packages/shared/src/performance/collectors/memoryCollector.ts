/**
 * Memory Collector
 *
 * Collects memory usage metrics and reports to the performance server.
 * Platform-specific implementations handle the actual memory reading.
 */

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Get memory usage (platform-specific)
 */
function getMemoryUsage(): {
  heapUsed?: number;
  heapTotal?: number;
  external?: number;
  rss?: number;
} | null {
  // Web: performance.memory (Chrome only)
  if (typeof performance !== 'undefined' && (performance as any).memory) {
    const mem = (performance as any).memory;
    return {
      heapUsed: mem.usedJSHeapSize,
      heapTotal: mem.totalJSHeapSize,
    };
  }

  // Node.js / Electron main process
  if (
    typeof process !== 'undefined' &&
    typeof process.memoryUsage === 'function'
  ) {
    const mem = process.memoryUsage();
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss,
    };
  }

  // React Native: Would need native module
  // For now, return null (no data available)
  return null;
}

/**
 * Start memory collection
 *
 * @param intervalMs Collection interval in milliseconds (default: 500)
 */
export function startMemoryCollection(intervalMs = 100) {
  if (intervalId) {
    return; // Already running
  }

  const g = globalThis as any;

  intervalId = setInterval(() => {
    const memory = getMemoryUsage();
    if (memory && typeof g.__perfReportMemory === 'function') {
      g.__perfReportMemory(memory);
    }
  }, intervalMs);

  // Collect immediately
  const memory = getMemoryUsage();
  if (memory && typeof g.__perfReportMemory === 'function') {
    g.__perfReportMemory(memory);
  }
}

/**
 * Stop memory collection
 */
export function stopMemoryCollection() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export default {
  startMemoryCollection,
  stopMemoryCollection,
  getMemoryUsage,
};
