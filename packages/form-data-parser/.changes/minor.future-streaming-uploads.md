Add a `@remix-run/form-data-parser/future` entrypoint where `parseFormData()` streams file uploads to your upload handler instead of buffering them (see #12030). Future APIs are not stable and may change in any release, but they are a good indication of where this package will land in its next major release.

The future `FileUpload` is yielded as soon as the part's headers arrive, and its contents stream from the request body as you read them, so you can write a large upload to storage without holding it in memory. It has the same shape as `File`, with these differences:

- Its contents can be read once, and only while the upload handler is running
- `size` throws until the contents have been read
- `slice()` is not supported

If the upload handler returns a `FileUpload` without reading it, or there is no upload handler, `parseFormData()` reads it into a regular `File` and puts that in the `FormData`.

```ts
import { parseFormData } from '@remix-run/form-data-parser/future'

let formData = await parseFormData(request, async (fileUpload) => {
  let storageKey = crypto.randomUUID()
  await fileStorage.set(storageKey, fileUpload)
  return storageKey
})
```

Streaming makes large uploads faster and keeps memory flat, because the upload handler can start writing a file as soon as its first bytes arrive instead of after the whole file has been buffered. Measured on Node.js 24.18 with an Apple M5 Pro, as the median of 7 runs that each use a fresh process, with an upload handler that streams each file to storage:

| Request                     | Total time (stable → future) | Time until the upload handler is called | Peak memory growth   |
| --------------------------- | ---------------------------- | --------------------------------------- | -------------------- |
| 1 × 100 MiB file            | 67.7 ms → 36.6 ms            | 45.4 ms → 0.2 ms                        | 396 MiB → 29 MiB     |
| 5 × 20 MiB files            | 60.2 ms → 36.3 ms            | 9.5 ms → 0.2 ms                         | 165 MiB → 19 MiB     |
| 10 fields and an 8 KiB file | 0.58 ms → 0.52 ms            | 0.51 ms → 0.42 ms                       | No measurable change |

`ParseFormDataOptions`, `FormDataParseError`, `MaxFilesExceededError`, and the re-exported multipart parser errors are shared with the stable entrypoint, so `instanceof` checks work with either.

If your app handles file uploads, please give `@remix-run/form-data-parser/future` a try and tell us how it goes in [GitHub Discussions](https://github.com/remix-run/remix/discussions). We'd especially like to hear about anything that breaks, behaves unexpectedly, or feels awkward, since that feedback will shape the next major release.
