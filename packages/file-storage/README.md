# file-storage

Key/value storage interfaces for server-side [`File` objects](https://developer.mozilla.org/en-US/docs/Web/API/File). `file-storage` gives Remix apps one consistent API across local disk and memory backends.

## Features

- **Simple API** - Intuitive key/value API (like [Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API), but for `File`s instead of strings)
- **Multiple Backends** - Built-in filesystem and memory backends
- **Streaming Support** - Stream file content to and from storage
- **Metadata Preservation** - Preserves all `File` metadata including `file.name`, `file.type`, and `file.lastModified`

## Installation

```sh
npm i remix
```

## Usage

### File System

```ts
import { createFsFileStorage } from 'remix/file-storage/fs'

let storage = createFsFileStorage('./user/files')

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

## Related Packages

- [`file-storage-s3`](https://github.com/remix-run/remix/tree/main/packages/file-storage-s3) - S3 backend for `file-storage`
- [`form-data-parser`](https://github.com/remix-run/remix/tree/main/packages/form-data-parser) - Pairs well with this library for storing `FileUpload` objects received in `multipart/form-data` requests
- [`lazy-file`](https://github.com/remix-run/remix/tree/main/packages/lazy-file) - The streaming `File` implementation used internally to stream files from storage

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
