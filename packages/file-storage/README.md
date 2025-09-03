# file-storage

`file-storage` is a key/value interface for storing [`File` objects](https://developer.mozilla.org/en-US/docs/Web/API/File) in JavaScript. Similar to how `localStorage` allows you to store key/value pairs of strings in the browser, `file-storage` allows you to store key/value pairs of files on the server.

## Features

- Simple, intuitive key/value API (like [Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API), but for `File`s instead of strings)
- A generic `FileStorage` interface that works for various large object storage backends (can be adapted to AWS S3, Cloudflare R2, etc.)
- Support streaming file content to and from storage
- Preserves all `File` metadata including `file.name`, `file.type`, and `file.lastModified`

## Installation

Install from [npm](https://www.npmjs.com/):

```sh
npm install @remix-run/file-storage
```

## Usage

```ts
import { LocalFileStorage } from '@remix-run/file-storage/local'

let storage = new LocalFileStorage('./user/files')

let file = new File(['hello world'], 'hello.txt', { type: 'text/plain' })
let key = 'hello-key'

// Put the file in storage.
await storage.set(key, file)

// Then, sometime later...
let fileFromStorage = await storage.get(key)
// All of the original file's metadata is intact
fileFromStorage.name // 'hello.txt'
fileFromStorage.type // 'text/plain'

// To remove from storage
await storage.remove(key)
```

The `FileStorage` interface allows you to implement your own file storage for custom storage backends:

```ts
import { type FileStorage } from '@remix-run/file-storage'

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

## Related Packages

- [`form-data-parser`](https://github.com/remix-run/remix/tree/v3/packages/form-data-parser) - Pairs well with this library for storing `FileUpload` objects received in `multipart/form-data` requests
- [`lazy-file`](https://github.com/remix-run/remix/tree/v3/packages/lazy-file) - The streaming `File` implementation used internally to stream files from storage

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
