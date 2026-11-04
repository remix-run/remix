Reflect locally rendered state in the URL with `updateUrl(href, options?)`, without fetching, rendering, or changing scroll and focus:

```ts
import { updateUrl } from 'remix/component'

await updateUrl('/products/shirt?color=blue')
await updateUrl('/products/shirt?color=red', { history: 'push' })
```

The current entry is replaced by default; `'push'` adds an entry. Application history state, Remix metadata, and the top-frame source stay in sync for later reloads and Back/Forward. Without frame navigation, applications restore displayed state themselves.

Calls capture the browser URL and wait for active navigation. Supersession, navigation/URL changes, and native cancellation reject with `AbortError`; only the latest waiting call applies. An optional `signal` cancels stale work without aborting navigation. Cross-origin URLs reject with `SecurityError`. Native interception of the update is unsupported: detected interception rejects with `NotSupportedError`, though the native mutation may still commit. `UpdateUrlOptions` is exported for typed options.
