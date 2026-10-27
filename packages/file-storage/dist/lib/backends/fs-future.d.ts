import type { LazyFile } from '@remix-run/lazy-file';
import type { FileStorage } from '../file-storage.ts';
/**
 * Creates a filesystem-backed {@link FileStorage} with atomic replacement writes.
 *
 * This future API is unstable. Failed writes preserve the previous entry by publishing complete
 * content and metadata together. Existing entries written by the stable filesystem backend can
 * be read and are migrated only when successfully replaced; no bulk migration is required.
 *
 * Use a directory dedicated to this backend. Stop all access through the stable backend before
 * switching a directory to this API; stable backends cannot read the versioned content format.
 * The process needs read and write access to content and metadata, and permission to create,
 * rename, and remove files in the directory. Existing POSIX permission modes are preserved.
 *
 * Callers must coordinate overlapping reads, writes, removals, and listings across all instances
 * and processes, including consumption of returned lazy files. Requires atomic rename within a
 * directory and does not guarantee persistence across power loss.
 *
 * @param directory The directory where files are stored
 * @returns A new {@link FileStorage} backed by a filesystem directory
 */
export declare function createFsFileStorage(directory: string): FileStorage<LazyFile>;
//# sourceMappingURL=fs-future.d.ts.map