BREAKING CHANGE: The `formData()` middleware now streams file uploads to its `uploadHandler` instead of buffering each file in memory first, following the `FileUpload` changes in `@remix-run/form-data-parser` 2.0 (see #12030). The handler is called as soon as a file's headers arrive, and the re-exported `FileUpload` type is no longer a `File`: its contents can be read once, only inside the handler, and `size` throws until they have been read. Returning the upload from the handler, which the default handler does, still stores an in-memory `File` in the parsed `FormData`. Handlers that keep uploads to read later must read them in the handler instead:

```diff
 formData({
   async uploadHandler(upload) {
-    uploads.push(upload)
+    uploads.push(await upload.text())
   },
 })
```
