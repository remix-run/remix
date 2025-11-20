# @remix-run/mime

Utilities for working with MIME types.

Data used for these utilities is generated at build time from [mime-db](https://github.com/jshttp/mime-db), but only includes standard MIME types, Experimental (`x-`) and vendor-specific (`vnd.`) MIME types have been excluded.

## Installation

```bash
npm install @remix-run/mime
```

## Usage

### `detectMimeType(extension)`

Detects the MIME type for a given file extension or filename.

```ts
import { detectMimeType } from '@remix-run/mime'

detectMimeType('txt') // 'text/plain'
detectMimeType('.txt') // 'text/plain'
detectMimeType('file.txt') // 'text/plain'
detectMimeType('path/to/file.txt') // 'text/plain'
detectMimeType('unknown') // undefined
```

### `isCompressibleMimeType(mimeType)`

Checks if a MIME type is known to be compressible.

```ts
import { isCompressibleMimeType } from '@remix-run/mime'

isCompressibleMimeType('text/html') // true
isCompressibleMimeType('application/json') // true
isCompressibleMimeType('image/png') // false
isCompressibleMimeType('video/mp4') // false
```

Fpr convenience, the function also accepts a full Content-Type header value:

```ts
import { isCompressibleMimeType } from '@remix-run/mime'

isCompressibleMimeType('text/html; charset=utf-8') // true
isCompressibleMimeType('application/json; charset=utf-8') // true
isCompressibleMimeType('image/png; charset=utf-8') // false
isCompressibleMimeType('video/mp4; charset=utf-8') // false
```

## License

MIT
