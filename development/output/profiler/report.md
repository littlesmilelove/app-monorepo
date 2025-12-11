# Function Performance Report

Analyzed 116 calls

## Top Offenders (>=120ms)
Name | Module | File:Line | Max (ms) | P95 (ms) | Avg (ms) | Count
---|---|---|---|---|---|---
ServiceAccountSelector.buildActiveAccountInfoFromSelectedAccount|kit-bg/services|../../packages/kit-bg/src/services/ServiceAccountSelector.ts:141|3895.20|3895.20|3895.20|1
ServiceReferralCode.fetchPostConfig|kit-bg/services|../../packages/kit-bg/src/services/ServiceReferralCode.ts:342|4909.40|3724.10|3781.70|3
ServiceSetting.fetchCurrencyList|kit-bg/services|../../packages/kit-bg/src/services/ServiceSetting.ts:236|3620.90|3620.90|3620.90|1
ServiceHyperliquid.updatePerpsConfigByServer|kit-bg/services|../../packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquid.ts:236|3606.50|3606.50|3606.50|1
@useCallback|kit/views|../../packages/kit/src/views/Swap/hooks/useSwapGlobal.ts:149|3561.80|3561.80|3561.80|1
anonymous|kit/views|../../packages/kit/src/views/Swap/hooks/useSwapGlobal.ts:579|3561.80|3561.80|3561.80|1
ServiceBootstrap.init|kit-bg/services|../../packages/kit-bg/src/services/ServiceBootstrap.ts:15|3495.30|3495.30|3495.30|1
ServiceAppUpdate.fetchAppUpdateInfo|kit-bg/services|../../packages/kit-bg/src/services/ServiceAppUpdate.ts:374|3481.60|3481.60|3481.60|1
anonymous|kit/views|../../packages/kit/src/views/Swap/hooks/useSwapGlobal.ts:573|3448.30|3448.30|3448.30|1
@useCallback|kit/views|../../packages/kit/src/views/Swap/hooks/useSwapGlobal.ts:88|3448.20|3448.20|3448.20|1
anonymous|kit/views|../../packages/kit/src/views/Swap/hooks/useSwapGlobal.ts:544|3424.60|3424.60|3424.60|1
ServiceSwap.fetchSwapConfigs|kit-bg/services|../../packages/kit-bg/src/services/ServiceSwap.ts:2318|3424.40|3424.40|3424.40|1
anonymous|kit-bg/services|../../packages/kit-bg/src/services/ServiceSetting.ts:211|3184.10|3184.10|3184.10|1
ServiceAppUpdate.fetchConfig|kit-bg/services|../../packages/kit-bg/src/services/ServiceAppUpdate.ts:41|3034.70|3034.70|3034.70|1
ServiceSwap.getSwapProviderManager|kit-bg/services|../../packages/kit-bg/src/services/ServiceSwap.ts:1157|3026.30|3026.30|3026.30|1
anonymous|kit/views|../../packages/kit/src/views/Swap/hooks/useSwapGlobal.ts:556|2978.30|2978.30|2978.30|1
anonymous|kit-bg/services|../../packages/kit-bg/src/services/ServiceMarketV2.ts:74|2817.20|2817.20|2817.20|1
ServiceSwap.fetchSwapTips|kit-bg/services|../../packages/kit-bg/src/services/ServiceSwap.ts:2304|2544.60|2544.60|2544.60|1
@usePromiseResult|kit/views|../../packages/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenList.ts:57|2088.40|2088.40|2088.40|1
ServiceMarketV2.fetchMarketTokenList|kit-bg/services|../../packages/kit-bg/src/services/ServiceMarketV2.ts:97|2087.80|2087.80|2087.80|1
runner|kit/hooks|../../packages/kit/src/hooks/usePromiseResult.ts:174|2088.60|2050.10|673.28|21
methodWithNonce|kit/hooks|../../packages/kit/src/hooks/usePromiseResult.ts:166|2088.50|2050.00|673.05|21
@usePromiseResult|kit/views|../../packages/kit/src/views/Market/hooks/useMarketBasicConfig/index.ts:18|2049.80|1999.30|2011.45|4
OnboardingOnMountCmp@useCallback|kit/views|../../packages/kit/src/views/Onboarding/components/OnboardingOnMount.tsx:159|757.90|757.90|757.90|1
OnboardingOnMountCmp@useCallback|kit/views|../../packages/kit/src/views/Onboarding/components/OnboardingOnMount.tsx:103|757.80|757.80|757.80|1
ServicePrime.isLoggedIn|kit-bg/services|../../packages/kit-bg/src/services/ServicePrime/ServicePrime.tsx:331|642.90|642.90|642.90|1
ServiceReferralCode.getPostConfig|kit-bg/services|../../packages/kit-bg/src/services/ServiceReferralCode.ts:353|642.50|642.50|642.50|1
ServiceSwap.swapLimitOrdersFetchLoop|kit-bg/services|../../packages/kit-bg/src/services/ServiceSwap.ts:1981|472.50|472.50|472.50|1
ServiceSwap.getCacheSwapSupportNetworks|kit-bg/services|../../packages/kit-bg/src/services/ServiceSwap.ts:1894|472.20|472.20|472.20|1
ServiceSwap.fetchSwapNetworks|kit-bg/services|../../packages/kit-bg/src/services/ServiceSwap.ts:227|3162.00|472.10|1817.05|2

## Modules
- kit-bg/services: max=4909.40ms avg=1105.81ms samples=59
- kit/views: max=3561.80ms avg=2187.56ms samples=15
- kit/hooks: max=2088.60ms avg=673.16ms samples=42

## Pages
- kit-bg/services:unknown max=4909.40ms avg=1105.81ms samples=59
- kit/views:unknown max=3561.80ms avg=2187.56ms samples=15
- kit/hooks:unknown max=2088.60ms avg=673.16ms samples=42

## Hot Call Chains
These call paths consume the most time:

1. **13693ms** (5x): `ServiceSetting.fetchCurrencyList → anonymous → @useEffect → anonymous`
2. **7010ms** (2x): `ServiceSetting.fetchCurrencyList → anonymous → @useEffect → anonymous → @useCallback`
3. **5997ms** (3x): `ServiceSetting.fetchCurrencyList → anonymous → ServiceApp.updateLaunchTimes → ServiceAccountSelector.buildActiveAccountInfoFromSelectedAccount → @useEffect → callback → runner`
4. **5996ms** (3x): `ServiceSetting.fetchCurrencyList → anonymous → ServiceApp.updateLaunchTimes → ServiceAccountSelector.buildActiveAccountInfoFromSelectedAccount → @useEffect → callback → runner → methodWithNonce`
5. **5996ms** (3x): `ServiceSetting.fetchCurrencyList → anonymous → ServiceApp.updateLaunchTimes → ServiceAccountSelector.buildActiveAccountInfoFromSelectedAccount → @useEffect → callback → runner → methodWithNonce → @usePromiseResult`
6. **4909ms** (1x): `ServiceBootstrap.init → ServiceSetting.refreshLocaleMessages → ServiceSetting.getCurrentLocale → WalletConnectDappSide.cleanupInactiveSessions → ServiceAccount.getSingletonAccountsOfWallet → ServiceSwap.syncSwapHistoryPendingList → anonymous → ServiceReferralCode.fetchPostConfig`
7. **4358ms** (9x): `ServiceSetting.fetchCurrencyList → anonymous → ServiceSwap.getSwapProviderManager → @useEffect → callback → runner`
8. **4357ms** (9x): `ServiceSetting.fetchCurrencyList → anonymous → ServiceSwap.getSwapProviderManager → @useEffect → callback → runner → methodWithNonce`
9. **3895ms** (1x): `ServiceSetting.fetchCurrencyList → anonymous → ServiceApp.updateLaunchTimes → ServiceAccountSelector.buildActiveAccountInfoFromSelectedAccount`
10. **3724ms** (1x): `ServiceSetting.fetchCurrencyList → anonymous → ServiceApp.updateLaunchTimes → ServiceSwap.fetchSwapNetworks → healthCheckRequest → anonymous → ServiceReferralCode.fetchPostConfig`

## Repeated Calls (Potential Optimization)
Functions called rapidly in succession (possible redundant calls):

Function | Rapid Calls | Total Time (ms) | File
---|---|---|---
methodWithNonce|13|8725|../../packages/kit/src/hooks/usePromiseResult.ts
runner|13|8728|../../packages/kit/src/hooks/usePromiseResult.ts
ServiceNetwork.getAllNetworks|9|2411|../../packages/kit-bg/src/services/ServiceNetwork/ServiceNetwork.ts
ServiceNetwork.getNetwork|7|1982|../../packages/kit-bg/src/services/ServiceNetwork/ServiceNetwork.ts
@usePromiseResult|3|5996|../../packages/kit/src/views/Market/hooks/useMarketBasicConfig/index.ts
