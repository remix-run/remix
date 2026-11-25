Other fixes:

- `compressResponse()` from `remix/response/compress` and the `compression()` middleware from `remix/middleware/compression` no longer buffer the entire compressed response in memory when the client reads slowly.
- `detectMimeType()` and `detectContentType()` from `remix/mime` no longer throw for extensions that match inherited object properties, such as `file.constructor`.
- `object()` and `record()` from `remix/data-schema` no longer omit keys that passed validation from their results.
- `LazyBlob` and `LazyFile` from `remix/lazy-file` can be read in supported browsers without native `ReadableStream` async iteration, including Chrome and Edge 123 and Safari 17.5.
