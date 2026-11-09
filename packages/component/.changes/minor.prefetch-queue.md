Control speculative HTML loading with `run({ prefetch: { concurrency, filter, priority } })`. Remix queues requests with three concurrent HTML slots by default, deduplicates matching sources and targets, and discovers assets and opted-in nested frames. Larger priority scores start first, with ties in discovery order. Policy callbacks receive the source URL and `{ target, trigger, anchors }`; nested frames inherit their ancestor’s tracked links.

Queued priorities and filter decisions are cached across request completions. Scroll, resize, tracked DOM changes, or `app.invalidatePrefetch()` mark them stale for one refresh when a slot opens. Link removal or attribute changes cancel work with no remaining owners, navigation pauses new work, and `prefetch(src, { signal })` supports caller cancellation. Slots cover HTML body consumption and parsing; nested frames and asset hints continue after the slot is released. Existing `run({ prefetch(src, options) {} })` handlers remain full strategy overrides.

```ts
let app = run({
  loadModule,
  prefetch: {
    concurrency: 3,
    filter(src) {
      return !new URL(src).pathname.startsWith('/checkout')
    },
    priority(src, { trigger }) {
      return trigger === 'intent' ? 1 : 0
    },
  },
})

app.invalidatePrefetch()
```
