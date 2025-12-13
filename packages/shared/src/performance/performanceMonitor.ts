/**
 * Performance Monitoring - Main Entry
 *
 * This module provides the main entry point for initializing performance monitoring.
 * It should be called at the very beginning of the application, before other imports.
 *
 * Usage:
 *   import { initPerformanceMonitoring } from '@onekeyhq/shared/src/performance/performanceMonitor';
 *   await initPerformanceMonitoring({ platform: 'web' });
 *   // ... rest of the app imports
 */

import {
  startFPSCollection,
  stopFPSCollection,
} from './collectors/fpsCollector';
import {
  startMemoryCollection,
  stopMemoryCollection,
} from './collectors/memoryCollector';
import { installFunctionHitLogger } from './heartbeatLogger';
import { closePerfReporter, initPerfReporter } from './reporter';

import type { PerfEvent } from './reporter/types';

export interface PerformanceMonitoringOptions {
  platform: PerfEvent['platform'];
  serverUrl?: string;
  timeout?: number;
  collectMemory?: boolean;
  collectFPS?: boolean;
  memoryInterval?: number;
}

const DEFAULT_SERVER_URL = 'ws://localhost:9527';
const DEFAULT_TIMEOUT = 3000;

/**
 * Check if performance monitoring is enabled
 *
 * Detection order:
 * 1. URL parameter: ?perf=1 or ?perf_monitor=1
 * 2. globalThis.__PERF_MONITOR_ENABLED (can be set in console)
 * 3. process.env.PERF_MONITOR_ENABLED (build-time)
 * 4. __DEV__ mode with localStorage flag
 */
export function isPerfMonitoringEnabled(): boolean {
  // 1. Check URL parameter (web only)
  if (typeof globalThis !== 'undefined' && globalThis.location) {
    const params = new URLSearchParams(globalThis.location.search);
    if (
      params.get('perf') === '1' ||
      params.get('perf_monitor') === '1' ||
      params.get('PERF_MONITOR_ENABLED') === '1'
    ) {
      return true;
    }
  }

  // 2. Check globalThis runtime flag
  const g = globalThis as any;
  if (g.__PERF_MONITOR_ENABLED === true) {
    return true;
  }

  // 3. Check localStorage (for persistent enable in dev)
  if (typeof localStorage !== 'undefined') {
    try {
      if (localStorage.getItem('PERF_MONITOR_ENABLED') === '1') {
        return true;
      }
    } catch {
      // localStorage may be disabled
    }
  }

  // 4. Check environment variable (build-time injection)
  if (typeof process !== 'undefined' && process.env) {
    return (
      process.env.PERF_MONITOR_ENABLED === '1' ||
      process.env.PERF_MONITOR_ENABLED === 'true' ||
      process.env.RN_PROFILER_ENABLED === '1'
    );
  }

  return false;
}

/**
 * Initialize performance monitoring
 *
 * This function:
 * 1. Connects to the performance server via WebSocket
 * 2. Installs global hooks for reporting
 * 3. Starts system metrics collection (memory, FPS)
 *
 * @param options Configuration options
 * @returns Promise that resolves to true if connected, false otherwise
 */
export async function initPerformanceMonitoring(
  options: PerformanceMonitoringOptions,
): Promise<boolean> {
  const {
    platform,
    serverUrl = DEFAULT_SERVER_URL,
    timeout = DEFAULT_TIMEOUT,
    collectMemory = true,
    collectFPS = true,
    memoryInterval = 100,
  } = options;

  // eslint-disable-next-line no-console
  console.log(`[PerfMonitor] Initializing for platform: ${platform}`);

  const connected = await initPerfReporter({
    serverUrl,
    timeout,
    platform,
  });

  if (connected) {
    // Install function hit logger for Babel plugin hooks
    installFunctionHitLogger();

    // Start system metrics collection
    if (collectMemory) {
      startMemoryCollection(memoryInterval);
    }
    if (collectFPS) {
      startFPSCollection();
    }

    // eslint-disable-next-line no-console
    console.log('[PerfMonitor] Ready, collecting metrics...');
  } else {
    // eslint-disable-next-line no-console
    console.log('[PerfMonitor] Server not available, monitoring disabled');
  }

  return connected;
}

/**
 * Stop performance monitoring
 */
export function stopPerformanceMonitoring() {
  stopMemoryCollection();
  stopFPSCollection();
  closePerfReporter();
}

// Re-export types and utilities
export type { PerfEvent } from './reporter/types';
export {
  initPerfReporter,
  getPerfReporter,
  closePerfReporter,
} from './reporter';
export {
  startMemoryCollection,
  stopMemoryCollection,
} from './collectors/memoryCollector';
export {
  startFPSCollection,
  stopFPSCollection,
} from './collectors/fpsCollector';
