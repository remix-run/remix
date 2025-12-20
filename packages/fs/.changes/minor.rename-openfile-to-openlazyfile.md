BREAKING CHANGE: Renamed `openFile()` to `openLazyFile()`, removed `getFile()`

Since `LazyFile` no longer extends `File`, the function name now explicitly reflects the return type. The `getFile()` alias has also been removed—use `openLazyFile()` instead.

**Migration:**

```ts
import { openLazyFile } from '@remix-run/fs'

let lazyFile = openLazyFile('./document.pdf')

// Streaming
let response = new Response(lazyFile.stream())

// For non-streaming APIs that require a complete File (e.g. FormData)
formData.append('file', await lazyFile.toFile())
```

**Note:** `.toFile()` and `.toBlob()` read the entire file into memory. Only use these for non-streaming APIs that require a complete `File` or `Blob` (e.g. `FormData`). Always prefer `.stream()` if possible.
