# file-storage

Key/value storage interfaces for server-side [`File` objects](https://developer.mozilla.org/en-US/docs/Web/API/File). `file-storage` gives Remix apps one consistent API across local disk and memory backends.

## Features

- **Simple API** - Intuitive key/value API (like [Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API), but for `File`s instead of strings)
- **Multiple Backends** - Built-in filesystem and memory backends
- **Streaming Support** - Stream file content to and from storage
- **Metadata Preservation** - Preserves all `File` metadata including `file.name`, `file.type`, `file.size`, and `file.lastModified`

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

if (fileFromStorage != null) {
  // All of the original file's metadata is intact
  fileFromStorage.name // 'hello.txt'
  fileFromStorage.type // 'text/plain'

  // The filesystem backend returns a LazyFile, so you can stream it directly.
  let response = new Response(fileFromStorage.stream())
}

// To remove from storage
await storage.remove(key)
```

Writes stream content to a new `.dat` file, then atomically replace the `.meta.json` file to point to it. Failed writes leave the previous entry intact. This requires a filesystem that supports atomic rename within a directory; it does not guarantee persistence across power loss.

Callers are responsible for coordinating overlapping reads, writes, removals, and listings across all instances and processes sharing the directory. The returned `LazyFile` reads content on demand, so coordination must cover consuming the file or finishing/canceling its stream, not just the `get()` or `put()` call. Replacing or removing a key can delete content referenced by an earlier `LazyFile`.

Existing `.dat`/`.meta.json` entries remain readable and are upgraded when rewritten. Older package versions cannot read rewritten entries, so upgrade all processes sharing a directory together.

Failed writes attempt to remove unpublished files. After a successful replacement, deleting the previous content is best-effort and cannot cause the write to report failure. An interrupted process or failed cleanup can leave temporary metadata or unreferenced `.dat` files, which storage ignores. Reclaim these only while all operations and readers using the directory are stopped, preserving content referenced by current metadata (including the matching `<hash>.dat` for legacy metadata without a content pointer).

## Related Packages

- [`file-storage-s3`](../file-storage-s3/README.md) - S3 backend for `file-storage`
- [`form-data-parser`](../form-data-parser/README.md) - Pairs well with this library for storing `FileUpload` objects received in `multipart/form-data` requests
- [`lazy-file`](../lazy-file/README.md) - The streaming `File` implementation used internally to stream files from storage

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
