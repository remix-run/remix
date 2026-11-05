Fix several gaps in `t.useFakeTimers()`:

- `clearTimeout()` and `clearInterval()` now cancel real timers created before fake timers were enabled. Previously the fakes ignored those timers, so a test with a `timeout` option that enabled fake timers left its real timeout timer running after it finished, which later aborted the test's signal and kept the process alive.
- `setTimeout()` and `setInterval()` now pass extra arguments to the callback.
- In Node, fake timers return handles with `ref()`, `unref()`, `hasRef()`, and `refresh()`, so code that calls `.unref()` on a timer no longer throws.
