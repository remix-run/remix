# file-storage

`file-storage` is a key/value interface for storing [`File` objects](https://developer.mozilla.org/en-US/docs/Web/API/File) in JavaScript.

## Goals

- Provide a `FileStorage` interface that works for various large object storage backends
- Simple, intuitive key/value API (like [Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API), but for `File`s instead of strings)
- Support streaming file content to and from storage

## Installation

Install from [npm](https://www.npmjs.com/):

```sh
npm install @mjackson/file-storage
```

## Usage

```ts
import { LocalFileStorage } from "@mjackson/file-storage";

let storage = new LocalFileStorage("./user/files");

let file = new File(["hello world"], "hello.txt", { type: "text/plain" });
let key = "hello-key";

// Put the file in storage.
await storage.set(key, file);

// Then, sometime later...
let fileFromStorage = await storage.get(key);
// All of the original file's metadata is intact
fileFromStorage.name; // 'hello.txt'
fileFromStorage.type; // 'text/plain'

// To remove from storage
await storage.remove(key);
```

## License

See [LICENSE](https://github.com/mjackson/file-storage/blob/main/LICENSE)
