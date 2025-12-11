/**
 * Performance Monitoring Bootstrap
 *
 * This module provides a bootstrapping utility that initializes performance monitoring
 * before the main application starts. It ensures WebSocket connection is established
 * (or times out) before proceeding.
 *
 * Usage in entry files:
 *
 *   // Option 1: Using bootstrap function
 *   import { bootstrapWithPerfMonitoring } from '@onekeyhq/shared/src/performance/bootstrap';
 *   bootstrapWithPerfMonitoring({
 *     platform: 'web',
 *     onReady: () => require('./App'),
 *   });
 *
 *   // Option 2: Using async/await
 *   import { initPerformanceMonitoring, isPerfMonitoringEnabled } from '@onekeyhq/shared/src/performance/performanceMonitor';
 *   if (isPerfMonitoringEnabled()) {
 *     await initPerformanceMonitoring({ platform: 'web' });
 *   }
 *   require('./App');
 */

import {
  initPerformanceMonitoring,
  isPerfMonitoringEnabled,
} from './performanceMonitor';

import type { PerformanceMonitoringOptions } from './performanceMonitor';

export interface BootstrapOptions
  extends Partial<PerformanceMonitoringOptions> {
  platform: PerformanceMonitoringOptions['platform'];
  onReady: () => void;
  /**
   * Force enable/disable performance monitoring.
   * If not specified, uses isPerfMonitoringEnabled() to check environment.
   */
  enabled?: boolean;
}

/**
 * Bootstrap the application with performance monitoring.
 *
 * If performance monitoring is enabled, this function will:
 * 1. Initialize WebSocket connection to performance server
 * 2. Wait for connection (or timeout)
 * 3. Call onReady() to start the application
 *
 * If performance monitoring is disabled, onReady() is called immediately.
 *
 * @param options Bootstrap options
 */
export function bootstrapWithPerfMonitoring(options: BootstrapOptions) {
  const { platform, onReady, enabled, ...monitoringOptions } = options;

  const shouldEnable = enabled ?? isPerfMonitoringEnabled();

  if (!shouldEnable) {
    // Performance monitoring disabled, start app immediately
    onReady();
    return;
  }

  // eslint-disable-next-line no-console
  console.log('[Bootstrap] Performance monitoring enabled, connecting...');

  // Initialize performance monitoring and then start app
  void initPerformanceMonitoring({
    platform,
    ...monitoringOptions,
  }).then((connected) => {
    if (connected) {
      // eslint-disable-next-line no-console
      console.log('[Bootstrap] Connected, starting app...');
    } else {
      // eslint-disable-next-line no-console
      console.log(
        '[Bootstrap] Connection timeout, starting app without monitoring...',
      );
    }
    onReady();
  });
}

/**
 * Async version of bootstrap - use with top-level await
 *
 * Usage:
 *   await bootstrapPerfMonitoringAsync({ platform: 'web' });
 *   import('./App');
 */
export async function bootstrapPerfMonitoringAsync(
  options: Omit<BootstrapOptions, 'onReady'>,
): Promise<boolean> {
  const { platform, enabled, ...monitoringOptions } = options;

  const shouldEnable = enabled ?? isPerfMonitoringEnabled();

  if (!shouldEnable) {
    return false;
  }

  // eslint-disable-next-line no-console
  console.log('[Bootstrap] Performance monitoring enabled, connecting...');

  const connected = await initPerformanceMonitoring({
    platform,
    ...monitoringOptions,
  });

  if (connected) {
    // eslint-disable-next-line no-console
    console.log('[Bootstrap] Connected, starting app...');
  } else {
    // eslint-disable-next-line no-console
    console.log(
      '[Bootstrap] Connection timeout, starting app without monitoring...',
    );
  }

  return connected;
}

export {
  isPerfMonitoringEnabled,
  initPerformanceMonitoring,
  stopPerformanceMonitoring,
} from './performanceMonitor';
