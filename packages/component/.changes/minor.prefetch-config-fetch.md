Add `run({ prefetch: { fetch } })` to load each prefetched page, including nested `<Frame prefetch>` frames, through an app-provided `fetch(src, { target, signal })`. Remix keeps its default deduplication, asset discovery, `<link rel="prefetch">` hints, and nested-frame discovery, so an app can queue, rank, or throttle page loads without reimplementing them. A `prefetch` function still replaces the whole strategy.

```ts
run({
  loadModule,
  prefetch: {
    fetch: (src, { target, signal }) => scheduler.fetch(src, { target, signal }),
  },
})
```
