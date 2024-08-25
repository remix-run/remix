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

The `FileStorage` interface allows you to implement your own file storage for custom storage
backends:

```ts
import { type FileStorage } from "@mjackson/file-storage";

class CustomFileStorage implements FileStorage {
  /**
   * Returns `true` if a file with the given key exists, `false` otherwise.
   */
  has(key: string): boolean | Promise<boolean> {
    // ...
  }
  /**
   * Puts a file in storage at the given key.
   */
  set(key: string, file: File): void | Promise<void> {
    // ...
  }
  /**
   * Returns the file with the given key, or `null` if no such key exists.
   */
  get(key: string): File | null | Promise<File | null> {
    // ...
  }
  /**
   * Removes the file with the given key from storage.
   */
  remove(key: string): void | Promise<void> {
    // ...
  }
}
```

## Related packages

- [`lazy-file`](https://github.com/mjackson/lazy-file) - The streaming `File` implementation used
  internally to stream files from storage

## License

See [LICENSE](https://github.com/mjackson/file-storage/blob/main/LICENSE)
