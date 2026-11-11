Customize frame fetching and rendering without reimplementing form encoding, frame headers, cancellation, or response handling. The exported `defaultResolveFrame(src, options?, overrides?)` accepts `{ fetch, commit }`. The `fetch` override receives the prepared URL and request options and returns a `Response`; `commit(commitFrame, { response, signal })` wraps the default rendering of that response.

Frame resolvers now receive `options.navigationType` for navigation-driven loads, including client frames loaded within the response. Independent loads and `frame.reload()` calls leave it undefined. For example, reuse cached HTML on Back/Forward navigations:

```ts
import { defaultResolveFrame, run } from 'remix/component'

run({
  loadModule,
  resolveFrame(src, options) {
    return defaultResolveFrame(src, options, {
      fetch(url, init) {
        return fetch(url, {
          ...init,
          cache: options?.navigationType === 'traverse' ? 'force-cache' : 'default',
        })
      },
    })
  },
})
```

The `fetch` override can customize Fetch settings or construct a `Request` for application-managed caching, while the resolver validates its returned response. HTTP cache reuse still depends on the server's caching headers; `force-cache` can reuse stale responses.

Use `commit` to wrap frame rendering in `document.startViewTransition()`. `commitFrame()` starts rendering once and waits for the completed update, including navigation URL synchronization, scroll, focus, and followed redirects. Its cancellation signal also covers animations after rendering. Remix lets navigation proceed while the callback waits for an animation, and falls back to the default commit if the callback returns or throws without committing. Return the original response to preserve the commit callback; cloning does not copy it.
