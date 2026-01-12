`LazyFile` and `LazyBlob` no longer extend native `File` and `Blob`

Some runtimes (like Bun) bypass the JavaScript layer when accessing `File`/`Blob` internals, leading to issues with missing content due to the lazy loading behavior. `LazyFile` and `LazyBlob` now implement the same interface as their native counterparts but are standalone classes.

As a result:

- `lazyFile instanceof File` now returns `false`
- You cannot pass `LazyFile`/`LazyBlob` directly to `new Response(file)` or `formData.append('file', file)`
- Passing a `LazyFile`/`LazyBlob` directly to `Response` will throw an error with guidance on correct usage

**Migration:**

```ts
// Before
let response = new Response(lazyFile)

// After - streaming
let response = new Response(lazyFile.stream())

// After - for non-streaming APIs that require a complete File (e.g. FormData)
formData.append('file', await lazyFile.toFile())
```

**New methods added:**

- `LazyFile.toFile()`
- `LazyFile.toBlob()`
- `LazyBlob.toBlob()`

**Note:** `.toFile()` and `.toBlob()` read the entire content into memory. Only use these for non-streaming APIs that require a complete `File` or `Blob` (e.g. `FormData`). Always prefer `.stream()` when possible.
