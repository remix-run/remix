Reflect state the page already displays in the browser URL with `replaceUrl(href)`. It synchronously replaces the current history entry without fetching, rendering, or changing scroll and focus, including for fragment-only updates:

```ts
import { replaceUrl } from 'remix/component'

replaceUrl('/products/shirt?color=blue')
```

The top-frame source and Remix history state stay in sync so subsequent frame reloads and Back/Forward use the replacement URL. Application history state is preserved, and replacement works without frame navigation support. Cross-origin URLs throw a `SecurityError`; calls during an active navigation throw an `InvalidStateError` so the in-progress navigation can finish without being interrupted.
