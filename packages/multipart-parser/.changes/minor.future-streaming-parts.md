Add a `@remix-run/multipart-parser/future` entrypoint with a streaming multipart parser. Future APIs are not stable and may change in any release, but they are a good indication of where this package will land in its next major release.

`parseMultipartRequest()` and `parseMultipartStream()` from `/future` yield each `MultipartPart` as soon as its headers arrive, instead of after its content is buffered. Part content streams from the request body as you read it, so large files are never held in memory. Read each part once with `part.body`, `await part.bytes()`, `await part.text()`, or `for await...of`; content you skip is discarded when you continue to the next part. Breaking out of the loop early cancels the request body.

```ts
import { parseMultipartRequest } from '@remix-run/multipart-parser/future'

for await (let part of parseMultipartRequest(request)) {
  if (part.isFile) {
    await saveFile(part.filename, part.body)
  } else {
    console.log(part.name, await part.text())
  }
}
```

Because parts are yielded before their content is buffered, a large file is available to your code almost immediately, and memory stays flat no matter how big it is. Measured on Node.js 24.18 with an Apple M5 Pro, as the median of 7 runs that each use a fresh process, reading every part's content with `parseMultipartRequest()`:

| Request                     | Total time (stable → future) | Time until the first file part is yielded | Peak memory growth   |
| --------------------------- | ---------------------------- | ----------------------------------------- | -------------------- |
| 1 × 100 MiB file            | 37.0 ms → 34.8 ms            | 36.9 ms → 0.2 ms                          | 100 MiB → 44 MiB     |
| 5 × 20 MiB files            | 37.8 ms → 35.1 ms            | 8.4 ms → 0.2 ms                           | 59 MiB → 23 MiB      |
| 10 fields and an 8 KiB file | 0.43 ms → 0.47 ms            | 0.41 ms → 0.39 ms                         | No measurable change |

Compared to the stable entrypoint, `/future` drops the synchronous `parseMultipart()`, the `MultipartParser` class, and the `/node` entrypoint, and `MultipartPart` no longer has the `arrayBuffer`, `bytes`, `content`, `isText`, `size`, and `text` getters. The error classes are shared with the stable entrypoint, so `instanceof` checks work with either.

If your app handles file uploads, please give `@remix-run/multipart-parser/future` a try and tell us how it goes in [GitHub Discussions](https://github.com/remix-run/remix/discussions). We'd especially like to hear about anything that breaks, behaves unexpectedly, or feels awkward, since that feedback will shape the next major release.
