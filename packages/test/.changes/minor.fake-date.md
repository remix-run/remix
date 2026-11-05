`t.useFakeTimers()` now fakes `Date`, `performance.now()`, `setImmediate()`/`clearImmediate()`, and `AbortSignal.timeout()` along with the timer functions, so wall-clock code such as expiry checks and timestamps can be tested without injecting a clock. While fake timers are active, `Date.now()`, `new Date()`, and `performance.now()` read the fake clock and move forward only with `advance()` or `advanceAsync()`. `new Date(value)`, `Date.parse()`, `Date.UTC()`, and `instanceof Date` keep working. Immediates fire on the next `advance()`, and `AbortSignal.timeout(ms)` signals abort with a `TimeoutError` once the fake clock reaches `ms`.

Like Node's mock timers, the fake `Date` starts at the Unix epoch (`0`) and `performance.now()` starts at `0`. Tests that used fake timers while reading the real `Date`, or while relying on real immediates or `AbortSignal.timeout()`, now see fake time instead. Pass the new `now` option to start at a specific time:

```ts
let timers = t.useFakeTimers({ now: new Date('2030-01-01T00:00:00Z') })
```
