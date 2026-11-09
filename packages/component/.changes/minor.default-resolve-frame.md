Customize frame fetching without reimplementing form encoding, frame headers, cancellation, or response handling. The exported `defaultResolveFrame(src, options?, fetchImpl?)` accepts a fetch implementation that receives the prepared URL and request options and returns a `Response`.

Frame resolvers now receive `options.navigationType` for navigation-driven loads, including client frames loaded within the response. Independent loads and `frame.reload()` calls leave it undefined. For example, reuse cached HTML on Back/Forward navigations:

```ts
import { defaultResolveFrame, run } from 'remix/component'

run({
  loadModule,
  resolveFrame(src, options) {
    return defaultResolveFrame(src, options, (url, init) =>
      fetch(url, {
        ...init,
        cache: options?.navigationType === 'traverse' ? 'force-cache' : 'default',
      }),
    )
  },
})
```

The callback can customize Fetch settings or construct a `Request` for application-managed caching, while the resolver validates its returned response. HTTP cache reuse still depends on the server's caching headers; `force-cache` can reuse stale responses.
