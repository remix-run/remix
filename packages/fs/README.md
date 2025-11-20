# fs

Filesystem utilities using the Web File API.

This package provides utilities for working with files on the local filesystem using the Web [File API](https://developer.mozilla.org/en-US/docs/Web/API/File).

## Features

- **Web Standards** - Use the Web File API for maximum portability
- **Seamless Node.js Compat** - Works seamlessly with Node.js file descriptors and handles

## Installation

Install from [npm](https://www.npmjs.com/):

```sh
npm install @remix-run/fs
```

## Usage

### Opening Files

```ts
import { openFile } from '@remix-run/fs'

// Open a file from the filesystem
let file = openFile('./path/to/file.json')

// The file is lazy - no data is read until you call file.text(), file.bytes(), etc.
let json = JSON.parse(await file.text())

// You can override file metadata
let customFile = openFile('./image.jpg', {
  name: 'custom-name.jpg',
  type: 'image/jpeg',
  lastModified: Date.now(),
})
```

### Writing Files

```ts
import { openFile, writeFile } from '@remix-run/fs'

// Read a file and write it elsewhere
let file = openFile('./source.txt')
await writeFile('./destination.txt', file)

// Write to an open file handle
import * as fsp from 'node:fs/promises'
let handle = await fsp.open('./destination.txt', 'w')
await writeFile(handle, file)
await handle.close()
```

## Related Packages

- [`lazy-file`](https://github.com/remix-run/remix/tree/main/packages/lazy-file) - Lazy, streaming `Blob`/`File` implementation
- [`file-storage`](https://github.com/remix-run/remix/tree/main/packages/file-storage) - Storage abstraction for files

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
