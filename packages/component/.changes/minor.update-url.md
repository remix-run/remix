Reflect locally rendered state in the URL with `updateUrl(href, options?)`, without fetching, rendering, or changing scroll and focus:

```ts
import { updateUrl } from 'remix/component'

let signal = await updateUrl('/products/shirt?color=blue')
await updateUrl('/products/shirt?color=red', { history: 'push' })
```
