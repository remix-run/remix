Control system time and timers with `t.mock.timers.enable({ apis, now })`, `tick()`, `setTime()`, `runAll()`, and `reset()`. Date and due callbacks share a destination clock, and test completion or abort restores the original APIs. Standalone `mock.timers` supports explicit cleanup with `reset()` or `[Symbol.dispose]()`.

Node, Bun, and browser tests use the same clock engine, with Node 24.3 as the compatibility reference. Node and Bun workers also control `node:timers`, `node:timers/promises`, and `scheduler.wait`. Browser clocks control available globals. E2E clocks affect the worker, not the Playwright page. Intervals with nonpositive or missing delays use 1 ms and can cancel themselves inside callbacks in every runtime.

The existing `t.useFakeTimers()` handle retains its progressive `advance()` and `advanceAsync()` behavior; overlapping timer controllers now fail before globals are changed.
