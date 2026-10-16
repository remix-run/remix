BREAKING CHANGE: `parseFormData()` now streams file uploads instead of buffering each file in memory before calling the `uploadHandler` (see #12030). The handler is called as soon as a file's headers arrive, and the `FileUpload` it receives reads its contents straight from the request, so `await fileStorage.set(key, upload)` or `writeFile(path, upload.stream())` saves a large upload without holding it in memory.

`FileUpload` keeps the `File` properties and read methods (`name`, `type`, `lastModified`, `stream()`, `arrayBuffer()`, `bytes()`, `text()`), but it is no longer a `File` subclass and follows streaming rules:

- Its contents can be read once, and only inside the `uploadHandler`. Reading them again, or after the handler returns, throws a `TypeError`.
- `size` throws until the contents have been read, because it isn't known when the handler is called. Use the `maxFileSize` option to limit upload size.
- `slice()` and `toString()` throw.

Returning the upload unread from the handler, which the default handler does, still buffers it into an in-memory `File` in the parsed `FormData`, so code that only reads files from the result is unaffected. Handlers that read an upload after the parse returns, or keep it for later, must read it in the handler instead:

```diff
 let formData = await parseFormData(request, async (upload) => {
-  uploads.push(upload)
+  uploads.push(await upload.bytes())
 })
-let bytes = await uploads[0].bytes()
+let bytes = uploads[0]
```

Code that checks `upload instanceof File` or reads `upload.size` before reading the contents needs to be updated too.
