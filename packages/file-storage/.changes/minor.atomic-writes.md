Opt into failure-safe replacement with `createFsFileStorage(directory, { atomicWrites: true })`. This preserves the previous file if a replacement upload fails, such as when reusing a user's avatar key (see #11909).

```ts
import { createFsFileStorage } from 'remix/file-storage/fs'

let storage = createFsFileStorage('./uploads', { atomicWrites: true })
```

Legacy writes remain the default. All instances can read both formats; enabling the option writes versioned content and migrates legacy entries when they are successfully replaced. Already migrated entries continue to use atomic writes even if the option is later omitted or disabled. Upgrade every process sharing a directory before enabling the option. Older releases cannot reliably read versioned entries, and disabling the option does not convert them back for rollback.

Callers must still coordinate overlapping operations, including consumption of returned lazy files. Cleanup is best-effort, interrupted processes can leave unused files, and power-loss durability is not guaranteed.
