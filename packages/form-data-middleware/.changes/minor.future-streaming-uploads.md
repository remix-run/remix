Add a `@remix-run/form-data-middleware/future` entrypoint whose `formData()` middleware parses requests with `@remix-run/form-data-parser/future`, so file uploads stream to your `uploadHandler` instead of being buffered in memory (see #12030). Future APIs are not stable and may change in any release, but they are a good indication of where this package will land in its next major release.

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
