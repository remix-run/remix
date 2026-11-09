Prefetch selected nested frames with `<Frame preload={true}>`. When Remix prefetches ancestor HTML, it reads the frame's JSON metadata, fetches its same-origin source with the frame's target header, and scans the response for JavaScript, CSS, explicit image and font preloads, and further opted-in frames. Duplicate sources and targets are visited once per traversal. The flag does not initiate speculative requests during normal document loads. Custom `run({ prefetch(src, options) {} })` handlers retain control of discovery.

```diff
 import { Frame } from 'remix/component'

-<Frame name="reviews" src="/partials/reviews" />
+<Frame name="reviews" src="/partials/reviews" preload={true} />
```
