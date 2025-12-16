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

const DEFAULT_SERVER_PORT = 9527;
const DEFAULT_TIMEOUT = 3000;

/**
 * Get the default server URL based on platform
 * - Web/Desktop/Extension: localhost works fine
 * - iOS Simulator: localhost works fine
 * - Android Emulator: need to use 10.0.2.2 to reach host machine
 * - Physical devices: would need actual IP (not handled here)
 */
function getDefaultServerUrl(platform: PerfEvent['platform']): string {
  if (platform === 'android') {
    // Android emulator uses 10.0.2.2 to access host machine's localhost
    return `ws://10.0.2.2:${DEFAULT_SERVER_PORT}`;
  }
  return `ws://localhost:${DEFAULT_SERVER_PORT}`;
}

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
  // eslint-disable-next-line no-console
  console.log('[PerfMonitor] isPerfMonitoringEnabled() called');

  // 1. Check URL parameter (web only)
  if (typeof globalThis !== 'undefined' && globalThis.location) {
    const params = new URLSearchParams(globalThis.location.search);
    const perfParam = params.get('perf');
    const perfMonitorParam = params.get('perf_monitor');
    const envParam = params.get('PERF_MONITOR_ENABLED');
    // eslint-disable-next-line no-console
    console.log('[PerfMonitor] URL params check:', {
      perf: perfParam,
      perf_monitor: perfMonitorParam,
      PERF_MONITOR_ENABLED: envParam,
      search: globalThis.location.search,
    });
    if (
      perfParam === '1' ||
      perfMonitorParam === '1' ||
      envParam === '1'
    ) {
      // eslint-disable-next-line no-console
      console.log('[PerfMonitor] Enabled via URL param');
      return true;
    }
  } else {
    // eslint-disable-next-line no-console
    console.log('[PerfMonitor] No globalThis.location available');
  }

  // 2. Check globalThis runtime flag
  const g = globalThis as any;
  // eslint-disable-next-line no-console
  console.log('[PerfMonitor] globalThis.__PERF_MONITOR_ENABLED:', g.__PERF_MONITOR_ENABLED);
  if (g.__PERF_MONITOR_ENABLED === true) {
    // eslint-disable-next-line no-console
    console.log('[PerfMonitor] Enabled via globalThis flag');
    return true;
  }

  // 3. Check localStorage (for persistent enable in dev)
  if (typeof localStorage !== 'undefined') {
    try {
      const localStorageValue = localStorage.getItem('PERF_MONITOR_ENABLED');
      // eslint-disable-next-line no-console
      console.log('[PerfMonitor] localStorage PERF_MONITOR_ENABLED:', localStorageValue);
      if (localStorageValue === '1') {
        // eslint-disable-next-line no-console
        console.log('[PerfMonitor] Enabled via localStorage');
        return true;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('[PerfMonitor] localStorage check failed:', e);
    }
  } else {
    // eslint-disable-next-line no-console
    console.log('[PerfMonitor] localStorage not available');
  }

  // 4. Check environment variable (build-time injection)
  // eslint-disable-next-line no-console
  console.log('[PerfMonitor] process check:', {
    hasProcess: typeof process !== 'undefined',
    hasEnv: typeof process !== 'undefined' && !!process.env,
  });
  if (typeof process !== 'undefined' && process.env) {
    // eslint-disable-next-line no-console
    console.log('[PerfMonitor] process.env values:', {
      PERF_MONITOR_ENABLED: process.env.PERF_MONITOR_ENABLED,
      RN_PROFILER_ENABLED: process.env.RN_PROFILER_ENABLED,
    });
    const result =
      process.env.PERF_MONITOR_ENABLED === '1' ||
      process.env.PERF_MONITOR_ENABLED === 'true' ||
      process.env.RN_PROFILER_ENABLED === '1';
    if (result) {
      // eslint-disable-next-line no-console
      console.log('[PerfMonitor] Enabled via process.env');
    }
    return result;
  }

  // eslint-disable-next-line no-console
  console.log('[PerfMonitor] All checks failed, returning false');
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
    serverUrl,
    timeout = DEFAULT_TIMEOUT,
    collectMemory = true,
    collectFPS = true,
    memoryInterval = 100,
  } = options;

  // Use platform-specific default URL if not provided
  const finalServerUrl = serverUrl ?? getDefaultServerUrl(platform);

  // eslint-disable-next-line no-console
  console.log(`[PerfMonitor] Initializing for platform: ${platform}, server: ${finalServerUrl}`);

  const connected = await initPerfReporter({
    serverUrl: finalServerUrl,
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
