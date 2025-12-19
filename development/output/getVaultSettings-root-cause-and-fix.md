# getVaultSettings 高频慢调用 RootCause & Fix 总结

## 背景与现象

在性能监控（performance-server）中观察到：

- `getVaultSettings` 出现数千次调用（例如 `~6k+` 次）
- 且每次调用耗时常常达到 `100ms~1000ms` 级别，累计总耗时非常大
- 发生位置标记为：`../../packages/kit-bg/src/services/ServiceNetwork/ServiceNetwork.ts:322`（即 `ServiceNetwork.getVaultSettings()`）

同时，`packages/kit-bg/src/services/ServiceBootstrap.ts` 中已经加入了：

- `toggleBgApiSerializableChecking(false)`
- `preloadAllVaultSettings()`

但问题仍然出现。

## RootCause（根因）

### 1) 真正的“高频触发点”不在 vault settings，而在 AllNetwork 的嵌套并发

`getVaultSettings` 的调用爆炸并不是因为 settings 未缓存或未 preload，而是因为 **AllNetwork 逻辑在遍历 (networks × accounts) 时，对每一个组合都会触发一次 deriveType 的计算，而 deriveType 的实现链路里包含 `getVaultSettings`**。

典型链路如下（按实际代码调用关系）：

1. `ServiceAllNetwork.getAllNetworkAccounts()` 在遍历每个 network、每个 dbAccount 时：
   - 调用 `serviceNetwork.getDeriveTypeByTemplate({ accountId, networkId, template })`

2. `ServiceNetwork.getDeriveTypeByTemplate()`（`packages/kit-bg/src/services/ServiceNetwork/ServiceNetwork.ts`）内部会调用：
   - `getDeriveInfoItemsOfNetwork({ networkId })`

3. `ServiceNetwork.getDeriveInfoItemsOfNetwork()` 内部会调用：
   - `getDeriveInfoMapOfNetwork({ networkId })`

4. `ServiceNetwork.getDeriveInfoMapOfNetwork()` 内部会调用：
   - `this.getVaultSettings({ networkId })`

5. `ServiceNetwork.getVaultSettings()` 内部会调用：
   - `vaults/settings.ts` 的 `getVaultSettings({ networkId })`

因此，在 AllNetwork 的实现里，只要存在 “网络数 N × 账户数 M” 的遍历，就会触发近似 `N*M` 次 `getVaultSettings`（或间接链路的 `getVaultSettings`）。

这也是为什么看到的是 `6k+` 次：本质上是 AllNetwork 的数据构建路径把 `getVaultSettings` 放进了最内层的热循环。

### 2) “为什么会慢”：大量并发任务导致事件循环排队（wall-time 被拉长）

`vaults/settings.ts` 已经有 `vaultSettingsPromiseCacheByImpl` 的 Promise 缓存：

- 同一 `impl` 的 settings dynamic import 只会发生一次
- 并发请求会复用同一个 Promise

所以“取 settings 的 CPU 逻辑”理论上很快。

但性能监控记录的是函数的 **wall-time（开始到结束的时间）**，当一次性启动了非常多并发任务（`Promise.all(allNetworks.map(...))` + 内部 `Promise.all(dbAccounts.map(...))`），JS 线程/事件循环会被压爆，导致很多函数虽然做的事情不重，但要排队很久，最终表现为：

- 函数耗时变长（不是“计算慢”，而是“调度拥塞/排队”）
- profiler 把这些 wall-time 记成“慢调用”

因此：

- `preloadAllVaultSettings()` 只能减少“首次动态 import 的冷启动成本”
- 但解决不了 “(networks × accounts) 级别的调用风暴 + 全量并发导致的排队/拥塞”

### 3) perf 统计里看到的调用次数 ≠ UI->BG RPC 次数

这次 `getVaultSettings` 的大量记录来自 `function_call` 日志（由 `packages/shared/src/performance/heartbeatLogger.ts` 上报），记录的是“被插桩的函数调用”（BG 内部也会记录），不一定是 UI->BG 的桥接 RPC。

因此即使做了 UI proxy 层的调用合并，这次根因仍然会在 BG 内部出现：AllNetwork 在 BG 内部自己就能把调用打爆。

## 解决方案（整体思路）

目标：把 `getVaultSettings` 从 “最内层热循环” 中移除，并避免一次性创建海量异步任务造成事件循环拥塞。

核心策略分两类：

1) **减少调用次数（Cut the call chain）**
- deriveType/deriveInfo 的计算，本质上是 “对 deriveInfoMap（来自 vault settings）做一次匹配”，属于静态配置查询
- 不应该为每个 account 都走一遍 `serviceNetwork.getDeriveTypeByTemplate()` 的完整调用链
- 正确做法是：对每个 network（更准确：对每个 impl）加载一次 deriveInfoMap，然后在本地纯计算匹配 deriveType

2) **限制并发峰值（Limit concurrency）**
- 避免 `Promise.all(networks.map(...))` 一次性启动所有网络任务
- 通过 worker pool / concurrency limit，把并发峰值压下去，避免调度拥塞导致 wall-time 虚高与页面卡顿

## 具体改动

### A) ServiceAllNetwork：本地计算 deriveType，避免反复触发 getVaultSettings 链路

文件：`packages/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork.ts`

#### 1) 新增本地匹配函数：`getDeriveTypeByTemplateFromDeriveInfoMap()`

- 位置：`ServiceAllNetwork` 类内（新增私有方法）
- 作用：复刻 `ServiceNetwork.getDeriveTypeByTemplate()` 的核心匹配逻辑
  - 支持普通 template 匹配
  - 支持 `useAddressEncodingDerive`（例如 Kaspa）下，按 `accountId` 后缀匹配 `addressEncoding` 的分支
- 输入：`accountId + template + deriveInfoMap`
- 输出：`deriveType + deriveInfo`

这样在 AllNetwork 的热循环中，不再需要每个 account 都调用一次 `serviceNetwork.getDeriveTypeByTemplate()`。

#### 2) 每个 impl 只加载一次 deriveInfoMap（缓存 Promise）

- 新增：`deriveInfoMapCacheByImpl: Map<string, Promise<Record<string, IAccountDeriveInfo>>>`
- 在处理每个 network 时：
  - 通过 `networkUtils.getNetworkImpl({ networkId })` 得到 `impl`
  - 对每个 `impl` 只调用一次 `serviceNetwork.getDeriveInfoMapOfNetwork({ networkId })`
  - 后续同 `impl` 的网络复用同一个 Promise/结果

意义：
- 将 “每 (network, account) 取一次 settings” 变为 “每 impl 取一次 deriveInfoMap”
- 直接把最核心的调用次数从 `N*M` 降为 `~(impls)` 量级

#### 3) 全局 deriveType 的读取做网络级复用（避免重复 await）

对于 `includingNotEqualGlobalDeriveTypeAccount` 相关逻辑：

- 原来每个 account 可能都会触发一次 `getGlobalDeriveTypeOfNetwork`
- 现在改为 network 级别复用 `globalDeriveTypePromise`

这不是主根因，但能进一步减少重复 IO/Promise。

### B) ServiceAllNetwork：限制网络维度并发，避免事件循环拥塞

文件：`packages/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork.ts`

#### 1) 新增：`forEachWithConcurrency()`（worker pool）

- 位置：`ServiceAllNetwork` 类内（新增私有方法）
- 作用：以固定并发数（例如 8）遍历数组并执行异步函数
- 目的：避免一次性启动 `allNetworks.length` 个 network 任务（每个 network 内又会启动 `dbAccounts.length` 个任务）

#### 2) 替换 `Promise.all(allNetworks.map(...))` 为 `forEachWithConcurrency(allNetworks, 8, ...)`

意义：
- 把“并发峰值”控制住
- 减少大量 microtask/Promise 同时排队造成的 wall-time 虚高
- 改善真实用户体验（卡顿、掉帧、响应延迟）

> 注：当前改动主要限制了 network 维度的并发；如果 `dbAccounts` 很多，进一步对 accounts 维度也加 concurrency limit 会更稳。

## 结果与影响

### 1) 为什么现在 perf 里 `getVaultSettings` 次数会显著下降

因为 AllNetwork 不再为每个 account 调用 `serviceNetwork.getDeriveTypeByTemplate()`，从而切断了：

`getDeriveTypeByTemplate -> getDeriveInfoItemsOfNetwork -> getDeriveInfoMapOfNetwork -> getVaultSettings`

调用次数大幅减少后：
- 即使 `getVaultSettings` 仍被其他路径少量调用，也不会再出现几千次的调用风暴
- 并发峰值下降后，wall-time 虚高也会下降

### 2) 对 production/release mode 是否提升？

会提升，而且是“真实性能”提升，不是只对 dev/profiler：

- 减少了大量真实函数调用与对象/Promise创建
- 降低了 JS 事件循环的拥塞，减少卡顿/耗电
- release mode 虽然没有 dev 的 serializable 深度检查，但拥塞与热循环问题在 release 同样存在

## 关于 `vaults/settings.ts` 缓存与 preload 的意义

### 1) `vaultSettingsPromiseCacheByImpl`

它属于基础设施：
- 保证 settings 动态 import 的幂等与并发安全
- 防止其他调用点（非 AllNetwork）在同一时刻触发重复加载

### 2) `preloadAllVaultSettings()`（预热）是可选优化

在本次修复之后：
- 它不再是解决问题的关键（根因已不在“首次 import”）
- 仍可能减少某些链的首次进入抖动
- 代价是启动阶段额外的 CPU/IO/内存竞争（虽然 `void` 不阻塞，但会抢资源）

是否保留取决于产品目标：
- 更关注“启动后首次进入某链页面更顺”：保留或做“按启用网络/常用网络预热”
- 更关注“启动阶段轻量、首屏快”：考虑移除全量预热，改成按需

### 3) `toggleBgApiSerializableChecking(false)`（dev-only）与本次根因无关

`ensureSerializable()` 仅在 `NODE_ENV !== 'production'` 才启用深度检查，因此它主要影响 dev 性能与调试体验：

- 关闭检查可以降低 dev 下 UI<->BG 返回大对象时的校验开销
- 但会掩盖“返回值不可序列化”的真实问题

更建议的策略是：仅在 perf profiling 开启时临时关闭，而不是常态关闭。

## 关联文件清单（便于回溯）

- 根因链路相关：
  - `packages/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork.ts`
  - `packages/kit-bg/src/services/ServiceNetwork/ServiceNetwork.ts`（`getDeriveTypeByTemplate`, `getDeriveInfoItemsOfNetwork`, `getDeriveInfoMapOfNetwork`, `getVaultSettings`）
  - `packages/kit-bg/src/vaults/settings.ts`（`vaultSettingsPromiseCacheByImpl`, `preloadAllVaultSettings`）
  - `packages/shared/src/performance/heartbeatLogger.ts`（function_call 上报）

- 本次修复点：
  - `packages/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork.ts`

## 后续建议（可选）

1) 如果 `dbAccounts` 可能非常多，可以进一步对 accounts 维度也加并发上限，避免单个 network 内仍然 `Promise.all(dbAccounts.map(...))`。
2) 将并发数做成平台/设备可配置（低端机更小，高端机更大）。
3) 对 deriveInfoMap 的缓存策略可进一步收敛为“按 impl 预加载一次”，避免不同路径重复取同一份配置。

