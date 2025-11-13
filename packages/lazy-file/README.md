# lazy-file

`lazy-file` is a lazy, streaming `Blob`/`File` implementation for JavaScript.

It allows you to easily create [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) and [File](https://developer.mozilla.org/en-US/docs/Web/API/File) objects that defer reading their contents until needed, which is ideal for situations where a file's contents do not fit in memory all at once. When file contents are read, they are streamed to avoid buffering.

## Features

- **Deferred Loading** - Blob/file contents loaded on demand to minimize memory usage
- **Drop-in Replacement** - `LazyBlob extends Blob` and `LazyFile extends File` so instances can be used anywhere you'd normally expect a regular `Blob`/`File`
- **Standard Constructors** - Accepts all the same content types as the original [`Blob()`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/Blob) and [`File()`](https://developer.mozilla.org/en-US/docs/Web/API/File/File) constructors
- **Slice Support** - Supports [`Blob.slice()`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice), even on streaming content

## The Problem

JavaScript's [File API](https://developer.mozilla.org/en-US/docs/Web/API/File) is useful, but it's not a great fit for streaming server environments where you don't want to buffer file contents. In particular, [`the File() constructor`](https://developer.mozilla.org/en-US/docs/Web/API/File/File) requires the contents of a file to be supplied up front when the object is first created, like this:

```ts
let file = new File(['hello world'], 'hello.txt', { type: 'text/plain' })
```

A `LazyFile` improves this model by accepting an additional content type in its constructor: `LazyContent`.

```ts
let lazyContent: LazyContent = {
  /* See below for usage */
}
let file = new LazyFile(lazyContent, 'hello.txt', { type: 'text/plain' })
```

All other `File` functionality works as you'd expect.

## Installation

Install from [npm](https://www.npmjs.com/):

```sh
npm install @remix-run/lazy-file
```

## Usage

The low-level API can be used to create a `File` that streams content from anywhere:

```ts
import { type LazyContent, LazyFile } from '@remix-run/lazy-file'

let content: LazyContent = {
  // The total length of this file in bytes.
  byteLength: 100000,
  // A function that provides a stream of data for the file contents,
  // beginning at the `start` index and ending at `end`.
  stream(start, end) {
    // ... read the file contents from somewhere and return a ReadableStream
    return new ReadableStream({
      start(controller) {
        controller.enqueue('X'.repeat(100000).slice(start, end))
        controller.close()
      },
    })
  },
}

let file = new LazyFile(content, 'example.txt', { type: 'text/plain' })
await file.arrayBuffer() // ArrayBuffer of the file's content
file.name // "example.txt"
file.type // "text/plain"
```

The `lazy-file/fs` export provides functions for reading from and writing to the local filesystem using the `File` API.

```ts
import { openFile, findFile, writeFile } from '@remix-run/lazy-file/fs'

// No data is read at this point, it's just a reference to a
// file on the local filesystem
let file = openFile('./path/to/file.json')

// Alternatively, find a file within a root directory, returning
// null if the file is not found. The file.name will be set to the
// relative path argument (e.g., 'assets/favicon.ico')
let foundFile = await findFile('./public', 'assets/favicon.ico')
console.log(foundFile ? `Found ${foundFile.name}` : 'File not found')

// Data is read when you call file.text() (or any of the
// other Blob methods, like file.bytes(), file.stream(), etc.)
let json = JSON.parse(await file.text())

// Write the file's contents back to the filesystem at a
// different path
await writeFile('./path/to/other-file.json', file)

// Or write to an open file handle/descriptor
import * as fsp from 'node:fs/promises'
let handle = await fsp.open('./path/to/other-file.json')
await writeFile(handle, file)

let imageFile = openFile('./path/to/image.jpg')

// Get a LazyBlob that omits the first 100 bytes of the file.
// This could be useful e.g. when serving HTTP Range requests
let blob = imageFile.slice(100)
```

All file contents are read on-demand and nothing is ever buffered.

## Related Packages

- [`file-storage`](https://github.com/remix-run/remix/tree/main/packages/file-storage) - Uses `lazy-file/fs` internally to create streaming `File` objects from storage on disk

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
