# File Uploads

Read when a multipart form can consume memory, write files, or associate uploads with a user/resource.

Installed API docs: `src/form-data-middleware/README.md`, `src/form-data-parser/README.md`, `src/file-storage/README.md`, and the chosen storage backend's README. Use the auth recipe for [session and CSRF setup](auth-and-sessions.md).

## Plan the Request Lifecycle

1. **Bound the request.** Configure proxy/server limits where available and parser limits for file count, individual size, total size, part count, and header size. Do not rely on client-side checks or MIME metadata.
2. **Authenticate and authorize.** For private uploads, check identity and destination ownership before permanent storage writes. A global `formData({ uploadHandler })` can run before controller guards; adding `requireAuth()` to the controller does not protect earlier writes.
3. **Choose a CSRF transport.** A token in a request header can be checked before parsing. An ordinary multipart form carries its token in the body, so bounded parsing or temporary staging must precede form-field CSRF validation. Do not commit those staged files until the token and authorization checks pass.
4. **Parse once.** Use scoped `formData()` middleware when downstream consumers need `context.get(FormData)`, or `parseFormData(context.request, options, uploadHandler?)` inside an already-guarded action when it owns parsing and errors. Do not re-read a body already consumed by global middleware.
5. **Validate the content and fields.** Check the actual file format as needed, allowed size/type, and related fields. Original filenames and declared MIME types are untrusted metadata, not permission to execute, serve inline, or choose a storage path.
6. **Commit the upload.** Generate an app-owned storage key, associate it with the authorized owner, and persist metadata. Use a unique key, not `file.name` or a submitted path. Private uploads belong outside root `public/` and the browser-source allowlist.
7. **Clean up.** Remove staged or newly stored files if validation, authorization, database writes, or the request fail. Track only this request's keys; never remove a previous upload until its replacement is committed. Plan recovery for crashes between file and database writes.

## Bound Parsing Before Adding Storage

For example, inside an action that has already checked access, and whose body has not been parsed:

```ts
import { parseFormData } from 'remix/form-data-parser'

let formData = await parseFormData(context.request, {
  maxFiles: 1,
  maxFileSize: 5 * 1024 * 1024,
  maxTotalSize: 6 * 1024 * 1024,
  maxParts: 10,
  maxHeaderSize: 8 * 1024,
})

let avatar = formData.get('avatar')
if (!(avatar instanceof File) || avatar.size === 0) {
  return new Response('An avatar is required', { status: 400 })
}
```

This uses the parser's in-memory file handling; it is suitable only for bounded small uploads. For streaming storage, use the documented upload handler and consume each `FileUpload` while it is available. Preserve the same authorization, validation, and cleanup boundaries.

The parser options are also accepted by `formData(...)` middleware. Choose one parsing owner rather than stacking both approaches.

## Return Errors at the Layer That Can Catch Them

- Recognize documented multipart limit errors and return `413`. Use `400` for known malformed input and `415` for rejected media types where appropriate. Rethrow unexpected I/O/programming errors to the app's error boundary.
- An action's `try/catch` can handle its own `parseFormData(...)` call, but not a failure thrown by earlier middleware. Wrap parser middleware from outside if parsing happens there.
- `suppressErrors` is not an upload safety policy. Multipart limits still throw, and a custom upload handler may fail after writing data. Keep cleanup around the whole staged-upload lifecycle.
- When returning an HTML form error, use `context.render(...)` and the [enhanced form response policy](hydration-frames-navigation.md#preserve-form-error-responses). Browsers cannot repopulate file inputs; tell the user when a file must be selected again.
- Serve private downloads through an authorized route. Use `remix/response/file` and an explicit content/disposition policy, not a publicly reachable upload directory.

Verify valid upload, oversized body/file, excess parts/files, invalid content, unauthorized destination, failed CSRF, storage failure, and abandoned requests as relevant. Assert that rejected flows leave no permanent file or database row. Use disposable storage and close/remove it in test cleanup.
