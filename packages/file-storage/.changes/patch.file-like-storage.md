Add a `FileLike` alias and make `FileStorage` generic over the file-like value returned by each backend. `createFsFileStorage()` now exposes `LazyFile` return types from `get()` and `put()`.

Filesystem storage now persists file sizes in metadata instead of deriving them separately when listing files with metadata.
