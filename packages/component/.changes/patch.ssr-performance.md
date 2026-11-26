Server rendering with `renderToString()` and `renderToStream()` is faster and uses less memory, with no changes to app code. In our measurements on Node 24, `renderToString()` throughput improves 2.4x–6.7x across representative page, table, dashboard, deep component tree, and escaping-heavy benchmarks, and `renderToStream()` improves 1.1x–5.4x.

- `renderToString()` renders directly to an HTML string without going through a `ReadableStream` or UTF-8 encode/decode round-trip.
- Large component trees, inline `style` objects, `class`/`className` attributes, and HTML escaping allocate less per render while producing identical HTML output.
