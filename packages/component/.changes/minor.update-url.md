Reflect locally rendered state in the URL with `updateUrl(href, options?)`, without fetching, rendering, or changing scroll and focus:

```ts
import { updateUrl } from 'remix/component'

let signal = await updateUrl('/products/shirt?color=blue')
await updateUrl('/products/shirt?color=red', { history: 'push' })
```

The current entry is replaced by default; `'push'` adds an entry. Application history state, Remix metadata, and the top-frame source stay in sync for later reloads and Back/Forward. Without frame navigation, applications restore displayed state themselves.

Calls capture the browser URL and wait for active navigation. The promise resolves with an `AbortSignal`: aborted for cancellation, supersession, or invalidated URL context; otherwise the update completed. Only the latest waiting call applies. An optional `signal` cancels stale work without aborting navigation. Actual failures reject, including `SecurityError` for cross-origin URLs and `NotSupportedError` for detected native interception. Native interception is unsupported, and its mutation may still commit. `UpdateUrlOptions` is exported for typed options.
