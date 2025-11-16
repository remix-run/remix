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

## Cloudflare R2

Use the `R2FileStorage` provides an adapter to store and retrieve files from a Cloudflare R2 bucket from Workers. It uses the `FileStorage` interface and types from Cloudflare.

### Documentation
https://developers.cloudflare.com/r2/api/workers/workers-api-reference/#r2object-definition

## USAGE

```ts
import { R2FileStorage } from '@remix-run/file-storage/r2'

// Pass the bucket that will be used
let storage = new R2FileStorage(env.MY_BUCKET)

let file = new File(['hello world'], 'hello.txt', { type: 'text/plain' })
let key = 'user123/hello.txt'

// To check if R2 has file
await.storage.has(key)

// To set a file in R2
await storage.set(key,file)

// To get a file from R2
await storage.get(key)


// To upload file
let uploadedFile = await storage.put(key, file)

// response will return a file
return new Response(uploadedFile, {
   headers: {
    'Content-Type': uploadedFile.type,
    'Content-Length': String(uploadedFile.size),
  }
})

// To delete a file
await storage.remove(key)
```

### Listing

```ts
// Keys only
let a = await storage.list({ prefix: 'user123/' })

// Include metadata for each file
let b = await storage.list({ prefix: 'user123/', includeMetadata: true })
// b.files: [{ key, lastModified, name, size, type }, ...]

// Paginate with cursor
if (b.cursor !== undefined) {
  let c = await storage.list({ cursor: b.cursor })
}
```

## Options (R2)

`R2FileStorage` supports Cloudflare R2 options on `get`, `list` and `set`/`put`. Refer to the Cloudflare documentation to learn what these options are.

### Documentation
https://developers.cloudflare.com/r2/api/workers/workers-api-reference/#method-specific-types


### Examples
```ts
// Conditional + ranged GET
await storage.get(key, {
  onlyIf: {
    etagMatches: '"abc123"',
    uploadedAfter: new Date(Date.now() - 60_000),
  },
  range: { offset: 0, length: 1024 },
})

// Checksums, encryption, and metadata on PUT/SET
await storage.set(key, file, {
  httpMetadata: { contentType: file.type },
  sha256: new Uint8Array([/* ... */]),
  storageCLass: 'InfrequentAccess'
  customMetadata: { tag: 'docs' },
})
```

Notes:
- `set` merges default metadata with your options. Defaults include `httpMetadata.contentType` and `customMetadata` for `name`, `lastModified`, and `size`. Your provided `httpMetadata`/`customMetadata` override defaults if the same fields are set.
- `put` returns a new `File` whose `name` is the key. `get` returns a `File` whose `name` is the original filename (stored in metadata) when available.
- `list({ includeMetadata: true })` returns file metadata populated from R2 `httpMetadata`/`customMetadata`.

### Environment

`R2FileStorage` runs in Cloudflare Workers (or compatible environments) where an `R2Bucket` binding is available. For TypeScript, install `@cloudflare/workers-types` and declare your env binding:

```ts
import type { R2Bucket } from '@cloudflare/workers-types'

interface Env {
  MY_BUCKET: R2Bucket
}
```

## Related Packages

- [`form-data-parser`](https://github.com/remix-run/remix/tree/main/packages/form-data-parser) - Pairs well with this library for storing `FileUpload` objects received in `multipart/form-data` requests
- [`lazy-file`](https://github.com/remix-run/remix/tree/main/packages/lazy-file) - The streaming `File` implementation used internally to stream files from storage

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
