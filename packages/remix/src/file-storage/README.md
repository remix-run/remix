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

The stable filesystem backend writes directly to the content file. A failed replacement can leave the previous content partially overwritten. Use the [future API](#future-api) when a failed replacement must preserve the previous file.

## Future API

**Future APIs are not stable.** The `remix/file-storage/fs/future` entrypoint may change in any release, but it is a good indication of where this package will land in its next major release. The stable `remix/file-storage/fs` entrypoint keeps its existing behavior and storage format.

### Atomic Writes

The future backend always writes atomically. For example, an avatar upload usually reuses a key for each user:

```ts
import { createFsFileStorage } from 'remix/file-storage/fs/future'

let avatarStorage = createFsFileStorage('./uploads/user-avatars')

async function saveAvatar(userId: string, avatar: File) {
  await avatarStorage.set(`user-${userId}-avatar`, avatar)
}
```

Both `set()` and `put()` stream content to a new versioned `.dat` file, then atomically replace the `.meta.json` file to point to it. Failures before publication leave the previous entry intact. This requires a filesystem that supports atomic rename within a directory; it does not guarantee persistence across power loss.

The process needs read and write access to both content and metadata files, and permission to create, rename, and remove files in the storage directory. Atomic replacements preserve existing POSIX content and metadata permission modes.

Atomic replacements create new content and metadata files. They preserve POSIX permission mode bits but do not copy the previous files’ owner, group, or ACLs. Ownership and inherited permissions follow the filesystem’s rules for newly created files. If your deployment relies on custom ownership or ACLs, verify that newly created files grant access to the intended users and groups before adopting this backend.

If every upload uses a fresh key, you can also preserve the previous file by updating your application's reference only after the new upload succeeds, then removing the old entry.

### Upgrading Existing Storage

The future backend reads both legacy and versioned entries. Reading or listing an entry never migrates it. New entries use the versioned format, and legacy entries migrate when successfully replaced. No bulk migration is required.

To adopt it for an existing directory:

1. Stop all processes and readers accessing the directory through the stable backend.
2. Switch every instance that accesses the directory to the future import, ensure the required permissions, then resume operations.

```diff
-import { createFsFileStorage } from 'remix/file-storage/fs'
+import { createFsFileStorage } from 'remix/file-storage/fs/future'

 let storage = createFsFileStorage('./uploads')
```

Stable and future backends must not share the directory once future writes start. The stable backend cannot read versioned entries, even in this release. Switching the import back does not undo migration; rollback requires restoring a backup or converting versioned entries back to the legacy format while all operations are stopped.

### Coordinating Operations

Callers are responsible for coordinating overlapping reads, writes, removals, and listings across all instances and processes sharing the directory. The returned `LazyFile` reads content on demand, so coordination must cover consuming the file or finishing/canceling its stream, not just the `get()` or `put()` call. Replacing or removing a key can delete content referenced by an earlier `LazyFile`.

Atomic writes do not provide locking or coordinate concurrent requests.

### Cleanup

Failed atomic writes attempt to remove unpublished files. After a successful atomic replacement, deleting the previous content is best-effort and cannot cause the write to report failure. An interrupted process or failed cleanup can leave temporary metadata or unreferenced `.dat` files, which storage ignores. Reclaim these only while all operations and readers using the directory are stopped, preserving content referenced by current metadata (including the matching `<hash>.dat` for legacy metadata without a content pointer).

## Related Packages

- [`file-storage-s3`](../file-storage-s3/README.md) - S3 backend for `file-storage`
- [`form-data-parser`](../form-data-parser/README.md) - Pairs well with this library for storing `FileUpload` objects received in `multipart/form-data` requests
- [`lazy-file`](../lazy-file/README.md) - The streaming `File` implementation used internally to stream files from storage

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
