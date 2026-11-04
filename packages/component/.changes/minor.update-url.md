Reflect state the page already displays in the browser URL with `updateUrl(href, options?)`. It updates the URL without fetching, rendering, or changing scroll and focus, including for fragment-only updates. The current entry is replaced by default; `history: 'push'` adds an entry so Back returns to the previous URL:

```ts
import { updateUrl } from 'remix/component'

await updateUrl('/products/shirt?color=blue')
await updateUrl('/products/shirt?color=red', { history: 'push' })
```

The top-frame source and Remix history state stay in sync so subsequent frame reloads and Back/Forward use the matching URL. Fragment-only traversals retain native browser behavior without fetching or rendering. Application history state is carried into the updated entry, and a push leaves the previous entry unchanged. Updates work without frame navigation support; applications must restore displayed state on Back/Forward themselves in that mode. Cross-origin URLs reject with a `SecurityError`. Native navigation listeners can cancel an update, which rejects with an `AbortError` and does not apply the requested update or overwrite a replacement navigation started by the listener.

The URL changes synchronously when idle, unless a native precommit handler delays the commit. Each call captures the browser URL and waits for any active transition to finish. It rejects if that transition fails, an unrelated navigation starts, or the browser URL changes outside preceding queued `updateUrl()` calls. Queued calls apply in order, so the last applicable call wins. A call made before navigation commits rejects if the committed URL differs; call after commit or completion to update the destination instead. Pass `{ signal: handle.signal }` to cancel a pending update when the component unmounts. Cancellation rejects with the signal's reason without aborting navigation. Native interception is awaited and its failures propagate; cancellation or failure after dispatch does not roll back history. Relative URLs resolve when the update executes; an empty string keeps the current URL. `UpdateUrlOptions` is exported for typed options.
