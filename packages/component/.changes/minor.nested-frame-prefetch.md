Prefetch selected nested frames with `<Frame preload={true}>`. The default prefetch strategy follows opted-in same-origin frames recursively, sends each named frame's `name` as `X-Remix-Target`, and scans the response for JavaScript, CSS, and explicit image and font preloads. Each combination of source URL and frame target is visited once per traversal. The flag creates no extra speculative requests during normal document loads. Custom `run({ prefetch(src, options) {} })` handlers continue to replace the default strategy.

```diff
 import { Frame } from 'remix/component'

 function ProductPage() {
-  return () => <Frame name="reviews" src="/partials/reviews" />
+  return () => <Frame name="reviews" src="/partials/reviews" preload={true} />
 }
```
