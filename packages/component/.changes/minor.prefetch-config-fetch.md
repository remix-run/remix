Add `run({ prefetch: { fetch } })` to load each prefetched page, including nested frames, through an app-provided `fetch(src, { target, signal })`. Remix keeps its default deduplication, asset discovery, `<link rel="prefetch">` hints, and `depth` recursion, so an app can queue, rank, or throttle page loads without reimplementing them. `fetch` and `depth` configure the default strategy and can't be combined with `handler`.

```ts
run({
  loadModule,
  prefetch: {
    depth: 1,
    fetch: (src, { target, signal }) => scheduler.fetch(src, { target, signal }),
  },
})
```
