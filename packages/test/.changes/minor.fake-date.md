`t.useFakeTimers()` now fakes `Date` and `performance.now()` along with the timer functions, so wall-clock code such as expiry checks and timestamps can be tested without injecting a clock. While fake timers are active, `Date.now()`, `new Date()`, and `performance.now()` read the fake clock and move forward only with `advance()` or `advanceAsync()`. `new Date(value)`, `Date.parse()`, `Date.UTC()`, and `instanceof Date` keep working.

Like Node's and Sinon's mock timers, the fake `Date` starts at the Unix epoch (`0`) and `performance.now()` starts at `0`. Tests that used fake timers while reading the real `Date` now see the fake time instead. Pass the new `now` option to start at a specific time:

```ts
let timers = t.useFakeTimers({ now: new Date('2030-01-01T00:00:00Z') })
```
