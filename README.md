# lazy-file

`lazy-file` is a lazy, streaming `File` implementation for JavaScript. It allows you to easily [create `File` objects](https://developer.mozilla.org/en-US/docs/Web/API/File) that defer reading their contents until needed, which is ideal for situations where a file's contents do not fit in memory all at once.

## Features

- Subclasses `File` so `lazyFile instanceof File` works
- Accepts all the same content types as [`the File() constructor`](https://developer.mozilla.org/en-US/docs/Web/API/File/File)
- Supports [`Blob.slice(start, end)`](https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice), even on streaming content
- Memory efficient!

## The Problem

JavaScript's [`File` API](https://developer.mozilla.org/en-US/docs/Web/API/File) is useful, but it's not a great fit for streaming server environments where you don't want to buffer file contents. In particular, [the `File` constructor](https://developer.mozilla.org/en-US/docs/Web/API/File/File) requires the contents of a file to be supplied up front when the object is first created, like this:

```ts
let file = new File(["hello world"], "hello.txt", { type: "text/plain" });
```

A `LazyFile` improves this model by accepting an additional content type in its constructor: `LazyFileContent`. All other `File` functionality works as you'd expect.

## Installation

Install from [npm](https://www.npmjs.com/):

```sh
npm install @mjackson/lazy-file
```

## Usage

```ts
import { type LazyFileContent, LazyFile } from "@mjackson/lazy-file";

let content: LazyFileContent = {
  // The total length of this file in bytes.
  byteLength: 100000,
  // A "reader" function that provides a stream of data for the file contents,
  // beginning at the `start` index and ending at `end`.
  read(start, end) {
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

## License

See [LICENSE](https://github.com/mjackson/lazy-file/blob/main/LICENSE)
