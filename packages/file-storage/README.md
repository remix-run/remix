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

The examples below enable `atomicWrites` to preserve existing content if a replacement fails. For an existing storage directory, first follow the [upgrade guidance](#upgrading-existing-storage).

```ts
import { createFsFileStorage } from 'remix/file-storage/fs'

let storage = createFsFileStorage('./user/files', { atomicWrites: true })

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

### Atomic Writes

When `atomicWrites` is omitted or `false`, new files and existing legacy entries are written directly to their content files. If you replace a file under the same key and the upload fails or the process is interrupted, the previous content can be lost or partially overwritten. This can happen even when only one operation is running.

Enable `atomicWrites` when a failed replacement must preserve the previous file. For example, an avatar upload usually reuses a key for each user:

```ts
import { createFsFileStorage } from 'remix/file-storage/fs'

let avatarStorage = createFsFileStorage('./uploads/user-avatars', {
  atomicWrites: true,
})

async function saveAvatar(userId: string, avatar: File) {
  await avatarStorage.set(`user-${userId}-avatar`, avatar)
}
```

With `atomicWrites: true`, both `set()` and `put()` stream content to a new versioned `.dat` file, then atomically replace the `.meta.json` file to point to it. Failures before publication leave the previous entry intact. This requires a filesystem that supports atomic rename within a directory; it does not guarantee persistence across power loss.

If every upload uses a fresh key, you can instead preserve the previous file by updating your application's reference only after the new upload succeeds, then removing the old entry.

### Coordinating Operations

Callers are responsible for coordinating overlapping reads, writes, removals, and listings across all instances and processes sharing the directory. The returned `LazyFile` reads content on demand, so coordination must cover consuming the file or finishing/canceling its stream, not just the `get()` or `put()` call. Replacing or removing a key can delete content referenced by an earlier `LazyFile`.

`atomicWrites` does not provide locking or coordinate concurrent requests. These responsibilities apply with either setting.

### Upgrading Existing Storage

`atomicWrites` defaults to `false`. This release reads both legacy and versioned entries with either setting. Reading or listing an entry never migrates it. New and legacy entries keep the legacy write format until you opt in; with `atomicWrites: true`, new entries use the versioned format and legacy entries migrate when successfully replaced. No bulk migration is required.

Before enabling the option for a shared directory:

1. Upgrade every process that accesses the directory to a release that understands both formats, leaving `atomicWrites` disabled.
2. Once all processes are upgraded, enable `atomicWrites` consistently across them.

Migrated entries continue to use atomic writes even if the option is later omitted or set to `false`. Disabling the option does not convert those entries back to the legacy format. Older releases cannot reliably read versioned entries, so rolling back to one requires restoring or converting those entries first.

### Cleanup

Failed atomic writes attempt to remove unpublished files. After a successful atomic replacement, deleting the previous content is best-effort and cannot cause the write to report failure. An interrupted process or failed cleanup can leave temporary metadata or unreferenced `.dat` files, which storage ignores. Reclaim these only while all operations and readers using the directory are stopped, preserving content referenced by current metadata (including the matching `<hash>.dat` for legacy metadata without a content pointer).

## Related Packages

- [`file-storage-s3`](https://github.com/remix-run/remix/tree/main/packages/file-storage-s3) - S3 backend for `file-storage`
- [`form-data-parser`](https://github.com/remix-run/remix/tree/main/packages/form-data-parser) - Pairs well with this library for storing `FileUpload` objects received in `multipart/form-data` requests
- [`lazy-file`](https://github.com/remix-run/remix/tree/main/packages/lazy-file) - The streaming `File` implementation used internally to stream files from storage

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
