Prefetch selected nested frames by declaring `<link rel="preload" as="fetch" href="…">` in destination HTML and setting `run({ prefetch: { depth: 1 } })`. Each same-origin HTML response is scanned for JavaScript, CSS, and explicit image and font preloads. Higher depths follow declarations in those responses; the default `0` only scans the initial HTML. Set `data-rmx-target` on the preload link to send a named frame's target header. Custom handlers can be supplied as `prefetch: { handler }` or with the existing `prefetch: handler` shorthand, and retain control of discovery.

```diff
 import { run } from 'remix/component'

 run({
   loadModule,
+  prefetch: { depth: 1 },
 })
```
