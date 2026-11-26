Server rendering with `renderToString()` and `renderToStream()` is significantly faster and uses less memory, with no changes to app code.

- `renderToString()` renders directly to an HTML string without going through a `ReadableStream` or UTF-8 encode/decode round-trip.
- Component trees, inline `style` objects, `class`/`className` merging, and HTML/text escaping do less per-element allocation and attribute work during SSR.
