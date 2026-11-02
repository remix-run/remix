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

### Replacement Writes

`set()` and `put()` write complete content and metadata to temporary files before replacing the stored content file and then the metadata file with two atomic renames. An upload stream error, size-limit rejection, or other failure during staging leaves the previous entry untouched. Temporary files are removed on a best-effort basis; a stopped process or failed cleanup can leave `.upload-*` directories inside the storage subdirectories. Storage ignores these directories. Remove them only while all operations are stopped.

The two renames are not a transaction. There is a small window after the content rename and before the metadata rename where a reader can see complete new content with old metadata. If the second rename fails or the process stops in that window, this mismatch remains, and a rejected write may already have changed the content. The old filename, MIME type, and modification time can be returned with the new bytes; metadata listings can also report the old size, while `get()` obtains the size from the content file. For a new key, the content remains unpublished: `get()` returns `null`, `has()` returns `false`, and listings omit it. A successful retry with a fresh upload replaces both files; the original upload stream may already have been consumed.

The storage key still determines the `<hash>.dat` and `<hash>.meta.json` paths, and the metadata format is unchanged. Existing entries need no migration, and entries written by this version remain readable and writable by older versions. Rolling back does not repair an interrupted publication.

### Filesystem Requirements

Use a filesystem that supports atomic rename on the same filesystem. The process needs permission to create, rename, and remove files in each storage subdirectory, even when replacing an existing entry. Unlike direct overwrites, replacement cannot work with only write access to existing files in a directory that disallows creating or replacing files. Writes do not need to read existing metadata.

Replacements preserve existing POSIX permission mode bits, but create new files. Owner, group, and ACLs follow the filesystem's rules for newly created files rather than being copied from the previous files. Ensure newly created files grant access to the intended users and groups. Atomic rename does not guarantee persistence across power loss.

### Coordinating Operations

Callers must coordinate overlapping reads, writes, removals, and listings across all instances and processes sharing the directory, including older versions. Coordination must cover consuming returned lazy files or finishing/canceling their streams, not just awaiting `get()` or `put()`. This backend does not provide locking or snapshot reads.

## Related Packages

- [`file-storage-s3`](https://github.com/remix-run/remix/tree/main/packages/file-storage-s3) - S3 backend for `file-storage`
- [`form-data-parser`](https://github.com/remix-run/remix/tree/main/packages/form-data-parser) - Pairs well with this library for storing `FileUpload` objects received in `multipart/form-data` requests
- [`lazy-file`](https://github.com/remix-run/remix/tree/main/packages/lazy-file) - The streaming `File` implementation used internally to stream files from storage

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
