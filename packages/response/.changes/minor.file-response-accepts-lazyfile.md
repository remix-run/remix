`createFileResponse()` is now generic and accepts any file-like object

The function now accepts any object satisfying the `FileLike` interface, which includes both native `File` and `LazyFile` from `@remix-run/lazy-file`. This change supports the updated `LazyFile` class which no longer extends native `File`.

The generic type flows through to the `digest` callback in options, so you get the exact type you passed in:

```ts
// With native File - digest receives File
createFileResponse(nativeFile, request, {
  digest: async (file) => {
    /* file is typed as File */
  },
})

// With LazyFile - digest receives LazyFile
createFileResponse(lazyFile, request, {
  digest: async (file) => {
    /* file is typed as LazyFile */
  },
})
```
