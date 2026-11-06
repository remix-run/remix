Fix several gaps in `t.useFakeTimers()`:

- `clearTimeout()` and `clearInterval()` now cancel real timers created before fake timers were enabled. Previously the fakes ignored those timers, so a test with a `timeout` option that enabled fake timers left its real timeout timer running after it finished, which later aborted the test's signal and kept the process alive.
- `setTimeout()` and `setInterval()` now pass extra arguments to the callback.
- In Node, fake timers return handles with `ref()`, `unref()`, `hasRef()`, and `refresh()`, so code that calls `.unref()` on a timer no longer throws. Clearing an expired timeout's handle prevents `refresh()` from reactivating it.
- Calling `t.useFakeTimers()` again restores the previous clock before starting a new one, so cleanup restores the original `Date`. Repeated `restore()` calls have no effect.
- Fake `AbortSignal.timeout(ms)` validates its argument synchronously using Node's numeric integer range of `0` through `4294967295` in every runtime.
