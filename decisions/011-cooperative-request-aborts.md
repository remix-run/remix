# Treat request aborts cooperatively in `fetch-router`

`fetch-router` stops starting new work once `request.signal` aborts and rejects with the abort reason, but it no longer races work already in progress. Middleware and handlers that should stop when a client disconnects pass `context.request.signal` to the work they start.

`request.signal` aborts when the client goes away; `node-fetch-server` aborts it on disconnect. Since `fetch-router` first supported the signal (f97ade2bc2, October 2025), the router raced every pending async middleware and handler promise against it. `router.fetch()` and each middleware's `await next()` rejected the moment the request aborted, even if the code below them had not settled.

## What racing did

Racing stopped the router from _waiting_. It did not stop any work. A handler kept running after the race rejected, along with anything it had started, until that work finished or observed the signal itself. Work stops only when something passes the signal down, as `render()` does for frame requests (`packages/render-middleware/src/lib/render-ui.ts`) and `fetch-proxy` does for upstream requests (`packages/fetch-proxy/src/lib/fetch-proxy.ts`). When that work aborts, its rejection reaches every `await next()` without the router racing anything.

Racing also had costs:

- **Misleading cleanup.** A rejected `next()` no longer meant that everything downstream had finished. A transaction middleware that rolls back when `next()` rejects could roll back while the handler was still writing, and a pool middleware could release a connection the handler was still using. Logging and timing middleware recorded the request as finished too early.
- **Abandoned responses.** A response that resolved after the race rejected was discarded with its body still streaming, so `render()` kept rendering frames for disconnected clients. [#12190][abandoned-responses] fixed this by cancelling late bodies in several places in the router. That bug existed only because of racing.
- **Per-request overhead.** Each async request added and removed an abort listener, which costs about 80 ns on Node.js 24 in a microbenchmark. Each async layer also wrapped its promise in another promise. In the fetch-router dispatch benchmark (`packages/fetch-router/bench`), a request to an async handler took 457 ns with racing and 311 ns without it, and a request through three async middleware took 973 ns and 653 ns, averaged over several runs on an Apple M5 Pro. Requests with only synchronous middleware and handlers did not change, because they never raced.

Other Fetch routers, such as Hono, do not race handlers against `request.signal`. They leave cancellation to the code that does the work.

## What the router does now

The router checks the signal at boundaries instead of listening for it:

1. Before it starts, `router.fetch()` rejects with the abort reason if the request has already aborted.
2. Before each middleware and the handler run, it stops the chain if the request has aborted.
3. When an async middleware or handler settles after the request aborted, it rejects with the abort reason, even if the work failed with its own error, and cancels the body of any `Response` that arrived or would have been passed on. This keeps the fix from [#12190][abandoned-responses].

The outcomes are the same as before: `router.fetch()` rejects with the abort reason, a middleware's `catch` around `next()` sees it, and late response bodies are cancelled. Only the timing changed. These things now happen when downstream work settles or observes the signal, instead of the moment the request aborts. A handler that never settles used to make `router.fetch()` reject; now `router.fetch()` waits for it. That handler was already holding its memory either way, and racing did not free anything.

## Alternatives we considered

- **Keep racing every layer.** This preserves immediate rejection, but it keeps the misleading cleanup, the abandoned-response handling, and the per-request cost described above.
- **Race only in `router.fetch()`.** This would let the caller stop waiting while middleware still waits for its own downstream work. It still needs a listener for every async request and still abandons late responses. The main caller, `node-fetch-server`, cannot send anything to a disconnected client, so it gains nothing from settling sooner.
- **Move body cancellation into `node-fetch-server`.** `node-fetch-server` already skips sending a response after the request aborts, but `fetch-router` also runs outside it, in Bun, workers, and tests. Late bodies are cancelled where the router discards them.

## Compatibility

The documented contract holds: `router.fetch()` rejects with the abort reason when the request aborts. Only the timing changed, for code that ignores the signal, so the change ships as a minor release of `@remix-run/fetch-router` rather than a major one.

## When to revisit

1. A runtime adapter needs `router.fetch()` to settle promptly after an abort to free resources the caller holds.
2. Applications commonly need a request deadline that does not depend on handlers observing the signal. That points to a timeout middleware applications can opt into, not racing every layer by default.

[abandoned-responses]: https://github.com/remix-run/remix/pull/12190
