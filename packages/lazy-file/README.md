# lazy-file

A lazy, streaming `Blob`/`File` implementation for JavaScript.

It allows you to easily create [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob)-like and [File](https://developer.mozilla.org/en-US/docs/Web/API/File)-like objects that defer reading their contents until needed, which is ideal for situations where a file's contents do not fit in memory all at once. When file contents are read, they are streamed to avoid buffering.

## Features

- **Deferred Loading** - Blob/file contents loaded on demand to minimize memory usage
- **Familiar Interface** - `LazyBlob` and `LazyFile` implement the same interface as native `Blob` and `File`
- **Easy Conversion** - Convert to native `ReadableStream` with `.stream()`, or to native `Blob`/`File` with `.toBlob()` and `.toFile()`
- **Standard Constructors** - Accepts all the same content types as the original [`Blob()`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/Blob) and [`File()`](https://developer.mozilla.org/en-US/docs/Web/API/File/File) constructors
- **Slice Support** - Supports [`Blob.slice()`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice), even on streaming content

## Why You Need This

JavaScript's [File API](https://developer.mozilla.org/en-US/docs/Web/API/File) is useful, but it's not a great fit for streaming server environments where you don't want to buffer file contents. In particular, [`the File() constructor`](https://developer.mozilla.org/en-US/docs/Web/API/File/File) requires the contents of a file to be supplied up front when the object is first created, like this:

```ts
let file = new File(['hello world'], 'hello.txt', { type: 'text/plain' })
```

A `LazyFile` improves this model by accepting an additional content type in its constructor: `LazyContent`.

```ts
let lazyContent: LazyContent = {
  /* See below for usage */
}
let lazyFile = new LazyFile(lazyContent, 'hello.txt', { type: 'text/plain' })
```

All other `File` functionality works as you'd expect.

## Installation

```sh
npm i remix
```

## Usage

The low-level API can be used to create a `LazyFile` that streams content from anywhere:

```ts
import { type LazyContent, LazyFile } from 'remix/lazy-file'

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

let lazyFile = new LazyFile(content, 'example.txt', { type: 'text/plain' })
await lazyFile.arrayBuffer() // ArrayBuffer of the file's content
lazyFile.name // "example.txt"
lazyFile.type // "text/plain"
```

All file contents are read on-demand and nothing is ever buffered unless you explicitly call `.toFile()` or `.toBlob()`.

### Streaming Content

Use `.stream()` to get a `ReadableStream` for `Response` and other streaming APIs:

```ts
import { openLazyFile } from 'remix/fs'

let lazyFile = openLazyFile('./large-video.mp4')

let response = new Response(lazyFile.stream(), {
  headers: {
    'Content-Type': lazyFile.type,
    'Content-Length': String(lazyFile.size),
  },
})
```

### Converting to Native File/Blob

For non-streaming APIs that require a complete `File` or `Blob` (e.g. `FormData`), use `.toFile()` or `.toBlob()`.

```ts
let lazyFile = openLazyFile('./document.pdf')
let realFile = await lazyFile.toFile()

let formData = new FormData()
formData.append('document', realFile)
```

> **Note:** `.toFile()` and `.toBlob()` read the entire file into memory. Only use these for non-streaming APIs that require a complete `File` or `Blob` (e.g. `FormData`). Always prefer `.stream()` if possible.

## Related Packages

- [`fs`](https://github.com/remix-run/remix/tree/main/packages/fs) - Filesystem utilities for reading and writing files using the Web `File` API
- [`file-storage`](https://github.com/remix-run/remix/tree/main/packages/file-storage) - Storage abstraction for files on disk or in memory

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
