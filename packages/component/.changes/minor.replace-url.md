Reflect state the page already displays in the browser URL with `replaceUrl(href, options?)`. It replaces the current history entry without fetching, rendering, or changing scroll and focus, including for fragment-only updates:

```ts
import { replaceUrl } from 'remix/component'

await replaceUrl('/products/shirt?color=blue')
```

The top-frame source and Remix history state stay in sync so subsequent frame reloads and Back/Forward use the replacement URL. Application history state is preserved, and replacement works without frame navigation support. Cross-origin URLs reject with a `SecurityError`.

The URL changes synchronously when idle. During a navigation, replacement waits for that transition and rejects if it fails, is superseded, or changes destination. Pass `{ signal: handle.signal }` to cancel a pending replacement when the component unmounts. Cancellation rejects with the signal's reason without aborting the navigation. Relative URLs resolve when replacement executes. `ReplaceUrlOptions` is exported for typed options.
