# fs

Lazy, streaming filesystem utilities for JavaScript. This package provides utilities for working with files on the local filesystem using the [`LazyFile`](../lazy-file/README.md)/ native [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) API.

## Features

- **Web Standards** - Uses [`LazyFile`](../lazy-file/README.md) which matches the native [`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) API and provides `.stream()`, `.toFile()`, and `.toBlob()` for converting to native types.
- **Seamless Node.js Compat** - Works seamlessly with Node.js file descriptors and handles

## Installation

```sh
npm i remix
```

## Usage

### Opening Lazy Files

```ts
import { openLazyFile } from 'remix/fs'

// Open a file from the filesystem
let lazyFile = openLazyFile('./path/to/file.json')

// The file is lazy - no data is read until you call lazyFile.text(), lazyFile.bytes(), etc.
let json = JSON.parse(await lazyFile.text())

// You can override file metadata
let customLazyFile = openLazyFile('./image.jpg', {
  name: 'custom-name.jpg',
  type: 'image/jpeg',
  lastModified: Date.now(),
})
```

### Writing Files

```ts
import { openLazyFile, writeFile } from 'remix/fs'

// Read a file and write it elsewhere
let lazyFile = openLazyFile('./source.txt')
await writeFile('./destination.txt', lazyFile)

// Write to an open file handle
import * as fsp from 'node:fs/promises'
let handle = await fsp.open('./destination.txt', 'w')
await writeFile(handle, lazyFile)
await handle.close()
```

## Related Packages

- [`lazy-file`](../lazy-file/README.md) - Lazy, streaming `Blob`/`File` implementation
- [`file-storage`](../file-storage/README.md) - Storage abstraction for files

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
