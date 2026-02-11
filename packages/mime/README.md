# mime

MIME type detection and content-type helpers for Remix. This package maps extensions to MIME types and provides utilities for charset and compressibility checks.

## Features

- **MIME Detection** - Detect MIME types from extensions and filenames
- **Content-Type Helpers** - Build `Content-Type` values with charset handling
- **Compression Signals** - Check whether a media type is likely compressible
- **Generated Data** - Built from [mime-db](https://github.com/jshttp/mime-db)

## Installation

```sh
npm i remix
```

## Usage

### `detectMimeType(extension)`

Detects the MIME type for a given file extension or filename.

```ts
import { detectMimeType } from 'remix/mime'

detectMimeType('txt') // 'text/plain'
detectMimeType('.txt') // 'text/plain'
detectMimeType('file.txt') // 'text/plain'
detectMimeType('path/to/file.txt') // 'text/plain'
detectMimeType('unknown') // undefined
```

### `detectContentType(extension)`

Detects the Content-Type header value for a given file extension or filename, including `charset` for text-based types. See [`mimeTypeToContentType`](#mimetypetocontenttypemimetype) for charset logic.

```ts
import { detectContentType } from 'remix/mime'

detectContentType('css') // 'text/css; charset=utf-8'
detectContentType('.json') // 'application/json; charset=utf-8'
detectContentType('image.png') // 'image/png'
detectContentType('path/to/file.unknown') // undefined
```

### `isCompressibleMimeType(mimeType)`

Checks if a MIME type is known to be compressible.

```ts
import { isCompressibleMimeType } from 'remix/mime'

isCompressibleMimeType('text/html') // true
isCompressibleMimeType('application/json') // true
isCompressibleMimeType('image/png') // false
isCompressibleMimeType('video/mp4') // false
```

For convenience, the function also accepts a full Content-Type header value:

```ts
import { isCompressibleMimeType } from 'remix/mime'

isCompressibleMimeType('text/html; charset=utf-8') // true
isCompressibleMimeType('application/json; charset=utf-8') // true
isCompressibleMimeType('image/png; charset=utf-8') // false
isCompressibleMimeType('video/mp4; charset=utf-8') // false
```

### `mimeTypeToContentType(mimeType)`

Converts a MIME type to a Content-Type header value, adding `; charset=utf-8` to text-based MIME types: `text/*` (except `text/xml` which has built-in encoding declarations), `application/json`, `application/javascript`, and all `+json` suffixed types. All other types are returned unchanged.

```ts
import { mimeTypeToContentType } from 'remix/mime'

mimeTypeToContentType('text/css') // 'text/css; charset=utf-8'
mimeTypeToContentType('application/json') // 'application/json; charset=utf-8'
mimeTypeToContentType('application/ld+json') // 'application/ld+json; charset=utf-8'
mimeTypeToContentType('image/png') // 'image/png'
```

### `defineMimeType(definition)`

Registers or overrides a MIME type for one or more file extensions.

```ts
import { defineMimeType } from 'remix/mime'

defineMimeType({
  extensions: ['myformat'],
  mimeType: 'application/x-myformat',
})
```

You can also optionally configure the charset and whether the MIME type is compressible:

```ts
defineMimeType({
  extensions: ['myformat'],
  mimeType: 'application/x-myformat',
  compressible: true,
  charset: 'utf-8',
})
```

## License

MIT
