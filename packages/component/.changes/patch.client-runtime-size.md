Reduce the JavaScript that browsers download for `run()` and for components mounted with `createRoot()`.

Standalone roots that only use inline styles download less JavaScript. In the browser, stylesheet management and class-name rule generation now load with `css()`, `on()` direct event bindings load with `on()`, the mixin engine loads with `createMixin()`, and CSP nonce tracking and frame runtime helpers stay out of standalone `createRoot()` bundles unless `Frame` or `run()` is imported. SVG attribute handling is also simplified to pass canonical SVG attributes through directly while normalizing `xlinkHref` and `xlink:href` to SVG2 `href`.

Standalone roots only allocate frame registries when configured to resolve frames. Hydration now finds frames and client entries in one pass. A later render can retry a client entry when its loader throws synchronously.

Mixins can read their own `handle.signal` in `beforeUpdate` and `commit` listeners when their component schedules an update.

Component updates now look for a DOM insertion point only when they need one. A keyed element that returns while its removal is pending reuses its existing mixin without running setup twice and picks up changes to its `innerHTML`.

Range roots keep hydration inside their boundaries, even when a server-rendered tag differs from the client tag or text spans several DOM nodes.
