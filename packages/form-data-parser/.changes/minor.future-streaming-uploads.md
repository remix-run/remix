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

`ParseFormDataOptions`, `FormDataParseError`, `MaxFilesExceededError`, and the re-exported multipart parser errors are shared with the stable entrypoint, so `instanceof` checks work with either.
