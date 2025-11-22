# file-storage

`file-storage` is a key/value interface for storing [`File` objects](https://developer.mozilla.org/en-US/docs/Web/API/File) in JavaScript.

Handling file uploads and storage is a common requirement in web applications, but each storage backend (local disk, AWS S3, Cloudflare R2, etc.) has its own API and conventions. This fragmentation makes it difficult to write portable code that can easily switch between storage providers or support multiple backends simultaneously.

Similar to how `localStorage` allows you to store key/value pairs of strings in the browser, `file-storage` allows you to store key/value pairs of files on the server with a consistent interface regardless of the underlying storage mechanism.

## Features

- **Simple API** - Intuitive key/value API (like [Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API), but for `File`s instead of strings)
- **Generic Interface** - `FileStorage` interface that works for various large object storage backends (can be adapted to AWS S3, Cloudflare R2, etc.)
- **Streaming Support** - Stream file content to and from storage
- **Metadata Preservation** - Preserves all `File` metadata including `file.name`, `file.type`, and `file.lastModified`

## Installation

Install from [npm](https://www.npmjs.com/):

```sh
npm install @remix-run/file-storage
```

## Usage

### Local File System

```ts
import { createLocalFileStorage } from '@remix-run/file-storage/local'

let storage = createLocalFileStorage('./user/files')

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

### Amazon S3

```ts
import { createS3FileStorage } from '@remix-run/file-storage/s3'

let storage = createS3FileStorage({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  bucket: 'my-bucket',
  region: 'us-east-1',
})

// Use the same API as other storage implementations
await storage.set('my-key', file)
let retrieved = await storage.get('my-key')
```

The S3 implementation also supports:

- S3-compatible services (like MinIO, Cloudflare R2) via the `endpoint` option
- Temporary credentials via the `sessionToken` option
- All standard `FileStorage` operations including listing, pagination, and prefix filtering

## Related Packages

- [`form-data-parser`](https://github.com/remix-run/remix/tree/main/packages/form-data-parser) - Pairs well with this library for storing `FileUpload` objects received in `multipart/form-data` requests
- [`lazy-file`](https://github.com/remix-run/remix/tree/main/packages/lazy-file) - The streaming `File` implementation used internally to stream files from storage

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
