Add `createPrefetch({ signal, fetch })` to schedule page prefetches without losing Remix's asset discovery. Pass its result to `run({ prefetch })` and supply `fetch(src, options)` to decide when and how each page loads, for example to limit concurrency or back off when the server is overloaded. Remix still shares pending loads of the same page and target, discovers the page's JavaScript, CSS, and declared image and font preloads, and adds `<link rel="prefetch">` hints for them. Without `fetch`, pages load as they do by default.

```ts
import { createPrefetch, run } from 'remix/component'

let controller = new AbortController()

run({
  loadModule,
  prefetch: createPrefetch({
    signal: controller.signal,
    fetch: (src, options) => scheduler.run(() => loadPage(src, options)),
  }),
})
```
