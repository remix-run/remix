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

Use a directory dedicated to this backend. You can reuse an existing storage directory; storing a file under an existing key replaces that entry.

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

### Replacement Writes

`set()` and `put()` stage complete content and metadata in uniquely named temporary files beside their destinations, then atomically rename the content file into place followed by the metadata file. An upload stream error, size-limit rejection, or other failure during staging leaves the previous entry untouched.

The two renames are not a transaction. Between them, a reader can see complete new content with old metadata. If the metadata rename fails or the process stops between renames, that mismatch remains: the filename, MIME type, modification time, and listed size can be stale. `get()` obtains the size from the content file. For a new key, the content remains unpublished: `get()` returns `null`, `has()` returns `false`, and listings omit it.

A rejected write may therefore have changed the content. A successful retry replaces both files; supply a fresh upload if the original stream has already been consumed. Rolling back the package version does not repair an interrupted publication.

The storage key's SHA-256 hash determines the `<hash>.dat` and `<hash>.meta.json` paths. The file's name, content type, and bytes do not affect those paths. The filenames and metadata schema are unchanged, so existing entries need no migration and older versions can read and write entries produced by this version, subject to the filesystem permissions below.

### Filesystem Requirements

The storage directory is managed by the application. Keep the application's filesystem user, groups, and directory inheritance rules consistent across restarts and deployments. Configure access for other readers through directory permissions and inheritance; custom per-file ownership and ACL changes are not preserved when an entry is replaced.

Use a filesystem that supports atomic rename on the same filesystem. The process needs permission to create, rename, and remove files in each storage subdirectory. Replacements preserve existing POSIX read/write/execute mode bits; owner, group, and ACLs follow the filesystem's rules for newly created files. Writes do not need to read existing metadata. Atomic rename does not guarantee persistence across power loss.

### Coordinating Operations

Callers must coordinate overlapping reads, writes, removals, and listings across all instances and processes sharing the directory, including older versions. Coordination must cover consuming returned lazy files or finishing/canceling their streams, not just awaiting `get()` or `put()`. This backend does not provide locking or snapshot reads.

Temporary files are removed on a best-effort basis. A stopped process or failed cleanup can leave `<hash>.dat.<uuid>.upload` and `<hash>.meta.json.<uuid>.upload` files beside stored entries. Storage ignores these files, and each write uses a fresh UUID so abandoned uploads do not block later writes. Remove abandoned files only while all operations are stopped.

## Related Packages

- [`file-storage-s3`](../file-storage-s3/README.md) - S3 backend for `file-storage`
- [`form-data-parser`](../form-data-parser/README.md) - Pairs well with this library for storing `FileUpload` objects received in `multipart/form-data` requests
- [`lazy-file`](../lazy-file/README.md) - The streaming `File` implementation used internally to stream files from storage

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
