Reduce the JavaScript that browsers download for `run()` and for components mounted with `createRoot()`.

Mixins can read their own `handle.signal` in `beforeUpdate` and `commit` listeners when their component schedules an update.
