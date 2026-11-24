Reduce the JavaScript that browsers download for `run()` and for components mounted with `createRoot()`.

Standalone roots that only use inline styles download less JavaScript. Stylesheet management and class-name rule generation now load with `css()`, and the mixin runtime, `on()` direct event bindings, CSP nonce tracking, and frame runtime helpers stay out of standalone `createRoot()` bundles unless those features are used.

Standalone roots only allocate frame registries when configured to resolve frames. Hydration now finds frames and client entries in one pass. A later render can retry a client entry when its loader throws synchronously.

Mixins can read their own `handle.signal` in `beforeUpdate` and `commit` listeners when their component schedules an update.

Component updates now look for a DOM insertion point only when they need one. A keyed element that returns while its removal is pending reuses its existing mixin without running setup twice and picks up changes to its `innerHTML`.

Range roots keep hydration inside their boundaries, even when a server-rendered tag differs from the client tag or text spans several DOM nodes.
