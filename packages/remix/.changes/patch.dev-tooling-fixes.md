Development fixes:

- Barrel file import optimization in `remix/assets` no longer downloads unused modules in nested import graphs.
- HMR with `remix/component-hmr` no longer throws a `ReferenceError` when a component's setup creates a callback that uses a setup variable declared after it.
- `t.useFakeTimers()` in `remix/test` cancels real timers created before it was enabled, passes extra timer arguments to callbacks, returns Node timer handles with `unref()` and `refresh()`, and no longer stalls test and hook timeouts.
