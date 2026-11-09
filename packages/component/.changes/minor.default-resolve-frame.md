Customize frame fetching without reimplementing form encoding, frame headers, cancellation, or response handling. The exported `defaultResolveFrame(src, options?, overrides?)` accepts Fetch overrides for `cache`, `headers`, `credentials`, and `priority`.

Frame resolvers now receive `options.navigationType` for navigation-driven loads, including client frames loaded within the response. Independent loads and `frame.reload()` calls leave it undefined. For example, reuse cached HTML on Back/Forward navigations:

```ts
import { defaultResolveFrame, run } from 'remix/component'

run({
  loadModule,
  resolveFrame(src, options) {
    return defaultResolveFrame(src, options, {
      cache: options?.navigationType === 'traverse' ? 'force-cache' : 'default',
    })
  },
})
```

Custom headers merge with the default headers, while frame headers and form Content-Type remain controlled by the resolver. Cache reuse still depends on the server's caching headers; `force-cache` can reuse stale responses.
