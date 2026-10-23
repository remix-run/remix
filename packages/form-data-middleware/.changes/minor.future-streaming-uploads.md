Add a `@remix-run/form-data-middleware/future` entrypoint whose `formData()` middleware parses requests with `@remix-run/form-data-parser/future`, so file uploads stream to your `uploadHandler` instead of being buffered in memory. Future APIs are not stable and may change in any release, but they are a good indication of where this package will land in its next major release.

In our benchmarks, parsing a request with a 100 MiB file through the future parser takes 37 ms instead of 68 ms and grows peak memory by 29 MiB instead of 396 MiB. See the `@remix-run/form-data-parser` changelog for the full comparison.

```ts
import { formData } from '@remix-run/form-data-middleware/future'

let middleware = formData({
  async uploadHandler(fileUpload) {
    let storageKey = crypto.randomUUID()
    await fileStorage.set(storageKey, fileUpload)
    return storageKey
  },
})
```

If your app handles file uploads, please give `@remix-run/form-data-middleware/future` a try and tell us how it goes in [GitHub Discussions](https://github.com/remix-run/remix/discussions). We'd especially like to hear about anything that breaks, behaves unexpectedly, or feels awkward, since that feedback will shape the next major release.
