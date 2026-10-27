Preserve the previous file when a replacement upload fails with `createFsFileStorage` from the new `remix/file-storage/fs/future` entrypoint (see #11909). This future API is unstable and may change in any release. The stable filesystem export keeps its existing behavior and storage format.

```ts
import { createFsFileStorage } from 'remix/file-storage/fs/future'

let storage = createFsFileStorage('./uploads')
await storage.set(`user-${userId}-avatar`, avatar)
```

The future backend always writes versioned content before publishing it through an atomic metadata rename. It reads legacy entries without modifying them and migrates them only on successful replacement, so no bulk migration is required. Existing POSIX content and metadata permission modes are preserved.

Before switching an existing directory, stop all access through the stable backend and switch every instance together:

```diff
-import { createFsFileStorage } from 'remix/file-storage/fs'
+import { createFsFileStorage } from 'remix/file-storage/fs/future'

 let storage = createFsFileStorage('./uploads')
```

The process needs read and write access to content and metadata, and permission to create, rename, and remove files in the directory. Stable backends cannot read versioned entries, including those shipped in this release. Rollback requires restoring a backup or converting those entries back to the legacy format while all operations are stopped.

Callers must still coordinate overlapping operations, including consumption of returned lazy files. Cleanup is best-effort, interrupted processes can leave unused files, and power-loss durability is not guaranteed.
