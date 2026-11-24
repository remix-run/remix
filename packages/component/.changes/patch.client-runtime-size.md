Reduce the JavaScript that browsers download for `run()` and for components mounted with `createRoot()`.

Standalone roots that only use inline styles download less JavaScript. The code that generates class names and rules now loads with `css()`.

Standalone roots only allocate frame registries when configured to resolve frames. Hydration now finds frames and client entries in one pass. A later render can retry a client entry when its loader throws synchronously.

Mixins can read their own `handle.signal` in `beforeUpdate` and `commit` listeners when their component schedules an update.
