Reflect state the page already displays in the browser URL with `updateUrl(href, options?)`. It updates the URL without fetching, rendering, or changing scroll and focus, including for fragment-only updates. The current entry is replaced by default; `history: 'push'` adds an entry so Back returns to the previous URL:

```ts
import { updateUrl } from 'remix/component'

await updateUrl('/products/shirt?color=blue')
await updateUrl('/products/shirt?color=red', { history: 'push' })
```

The top-frame source and Remix history state stay in sync so subsequent frame reloads and Back/Forward use the matching URL. Application history state is carried into the updated entry, and a push leaves the previous entry unchanged. Updates work without frame navigation support. Cross-origin URLs reject with a `SecurityError`.

The URL changes synchronously when idle. During a navigation, the update waits for that transition and rejects if it fails, is superseded, or changes destination. Pass `{ signal: handle.signal }` to cancel a pending update when the component unmounts. Cancellation rejects with the signal's reason without aborting the navigation. Relative URLs resolve when the update executes. `UpdateUrlOptions` is exported for typed options.
