/* eslint-disable unicorn/prefer-global-this */
/* eslint-disable import/first */

import { bootstrapWithPerfMonitoring } from '@onekeyhq/shared/src/performance/bootstrap';

if (typeof window !== 'undefined') {
  window.$$onekeyJsReadyAt = Date.now();
}

// Performance monitoring bootstrap (must be before other imports when enabled)
function startApp() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  require('@onekeyhq/shared/src/polyfills');
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  const { registerRootComponent } = require('expo');
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  const { initSentry, withSentryHOC } = require('@onekeyhq/shared/src/modules3rdParty/sentry');
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  const { SentryErrorBoundaryFallback } = require('@onekeyhq/kit/src/components/ErrorBoundary');
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  const { initIntercom } = require('@onekeyhq/shared/src/modules3rdParty/intercom');
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  const App = require('./App').default;

  initSentry();
  void initIntercom();

  // registerRootComponent calls AppRegistry.registerComponent('main', () => App);
  // It also ensures that whether you load the app in Expo Go or in a native build,
  // the environment is set up appropriately
  registerRootComponent(withSentryHOC(App, SentryErrorBoundaryFallback));
}

// Bootstrap with performance monitoring if enabled
bootstrapWithPerfMonitoring({
  platform: 'web',
  onReady: startApp,
});
