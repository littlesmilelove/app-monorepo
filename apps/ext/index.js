/* eslint-disable import/first */
/* eslint-disable unicorn/prefer-global-this */

import { bootstrapWithPerfMonitoring } from '@onekeyhq/shared/src/performance/bootstrap';

if (typeof window !== 'undefined') {
  window.$$onekeyJsReadyAt = Date.now();
}

// Performance monitoring bootstrap (must be before other imports when enabled)
function startApp() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  const { registerRootComponent } = require('expo');
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  const App = require('./App').default;

  // registerRootComponent calls AppRegistry.registerComponent('main', () => App);
  // It also ensures that whether you load the app in Expo Go or in a native build,
  // the environment is set up appropriately
  registerRootComponent(App);
}

// Bootstrap with performance monitoring if enabled
bootstrapWithPerfMonitoring({
  platform: 'ext',
  onReady: startApp,
});
