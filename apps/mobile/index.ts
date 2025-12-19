/* eslint-disable import/order */
import { Platform } from 'react-native';

import { bootstrapWithPerfMonitoring } from '@onekeyhq/shared/src/performance/bootstrap';

import './jsReady';

// Performance monitoring bootstrap (must be before other imports when enabled)
function startApp() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  const { I18nManager } = require('react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  const { registerRootComponent } = require('expo');
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  require('@onekeyhq/shared/src/polyfills');
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  const { initSentry } = require('@onekeyhq/shared/src/modules3rdParty/sentry');
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  const { installFunctionHitLogger } = require('@onekeyhq/shared/src/performance/heartbeatLogger');
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  const App = require('./App').default;

  initSentry();
  installFunctionHitLogger();

  I18nManager.allowRTL(true);

  // registerRootComponent calls AppRegistry.registerComponent('main', () => App);
  // It also ensures that whether you load the app in Expo Go or in a native build,
  // the environment is set up appropriately
  if (typeof globalThis.nativePerformanceNow === 'function') {
    globalThis.$$onekeyAppWillMountFromPerformanceNow =
      globalThis.nativePerformanceNow();
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(
        'onekeyAppWillMountFromPerformanceNow',
        (globalThis.$$onekeyAppWillMountFromPerformanceNow || 0) -
          (globalThis.$$onekeyJsReadyFromPerformanceNow || 0),
      );
    }
  }
  registerRootComponent(App);
}

// Bootstrap with performance monitoring if enabled
bootstrapWithPerfMonitoring({
  platform: Platform.OS === 'android' ? 'android' : 'ios',
  onReady: startApp,
});
