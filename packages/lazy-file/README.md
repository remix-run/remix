# lazy-file

`lazy-file` is a lazy, streaming `Blob`/`File` implementation for JavaScript.

It allows you to easily create [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) and [File](https://developer.mozilla.org/en-US/docs/Web/API/File) objects that defer reading their contents until needed, which is ideal for situations where a file's contents do not fit in memory all at once. When file contents are read, they are streamed to avoid buffering.

## Features

- Deferred loading of blob/file contents to minimize memory usage
- `LazyBlob extends Blob` and `LazyFile extends File` so instances can be used anywhere you'd normally expect a regular `Blob`/`File`
- Accepts all the same content types as the original [`Blob()`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/Blob) and [`File()`](https://developer.mozilla.org/en-US/docs/Web/API/File/File) constructors
- Supports [`Blob.slice()`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice), even on streaming content

## The Problem

JavaScript's [File API](https://developer.mozilla.org/en-US/docs/Web/API/File) is useful, but it's not a great fit for streaming server environments where you don't want to buffer file contents. In particular, [`the File() constructor`](https://developer.mozilla.org/en-US/docs/Web/API/File/File) requires the contents of a file to be supplied up front when the object is first created, like this:

```ts
let file = new File(["hello world"], "hello.txt", { type: "text/plain" });
```

A `LazyFile` improves this model by accepting an additional content type in its constructor: `LazyContent`.

```ts
let lazyContent: LazyContent = {
  /* See below for usage */
};
let file = new File(lazyContent, "hello.txt", { type: "text/plain" });
```

All other `File` functionality works as you'd expect.

## Installation

Install from [npm](https://www.npmjs.com/):

```sh
npm install @mjackson/lazy-file
```

## Usage

The low-level API can be used to create a `File` that streams content from anywhere:

```ts
import { type LazyContent, LazyFile } from "@mjackson/lazy-file";

let content: LazyContent = {
  // The total length of this file in bytes.
  byteLength: 100000,
  // A function that provides a stream of data for the file contents,
  // beginning at the `start` index and ending at `end`.
  stream(start, end) {
    // ... read the file contents from somewhere and return a ReadableStream
    return new ReadableStream({
      start(controller) {
        controller.enqueue("X".repeat(100000).slice(start, end));
        controller.close();
      }
    });
  }
};

let file = new LazyFile(content, "example.txt", { type: "text/plain" });
await file.arrayBuffer(); // ArrayBuffer of the file's content
file.name; // "example.txt"
file.type; // "text/plain"
```

The `lazy-file/fs` export provides a `getFile(filename)` function that allows you to create `File` objects from files on the local filesystem. These objects are lightweight and do not attempt to actually read from the file on disk until contents are requested.

```ts
import { getFile } from "@mjackson/lazy-file/fs";

// No data is read at this point, it's just a reference to a
// file on the local filesystem.
let file = getFile("./path/to/file.json");

// Data is read when you call file.text() (or any of the
// other Blob methods, like file.bytes(), file.stream(), etc.)
let json = JSON.parse(await file.text());

let imageFile = getFile("./path/to/image.jpg");

// Get a LazyBlob that omits the first 100 bytes of the file.
// This could be useful for serving HTTP Range requests.
let blob = imageFile.slice(100);
```

`lazy-file/fs` also serves as a good reference implementation for how to use this library effectively.

## Related Packages

- [`file-storage`](https://github.com/mjackson/remix-the-web/tree/main/packages/file-storage) - Uses `lazy-file/fs` internally to create streaming `File` objects from storage on disk

## License

See [LICENSE](https://github.com/mjackson/remix-the-web/blob/main/LICENSE)
