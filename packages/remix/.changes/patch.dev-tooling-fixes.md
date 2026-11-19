Development fixes:

- Barrel file import optimization in `remix/assets` no longer downloads unused modules in nested import graphs.
- HMR with `remix/component-hmr` no longer throws a `ReferenceError` when a component's setup creates a callback that uses a setup variable declared after it.
- Under `t.useFakeTimers()` in `remix/test`, `clearTimeout()` and `clearInterval()` cancel real timers created before fake timers were enabled, timer callbacks receive extra arguments, timer handles in Node support `unref()` and `refresh()`, and test and hook timeouts no longer stall.
