import type { LazyFile } from '@remix-run/lazy-file';
import type { FileStorage } from '../file-storage.ts';
/**
 * Options for filesystem-backed file storage.
 */
export interface FsFileStorageOptions {
    /**
     * Preserves the previous entry if a replacement write fails. Enable this when reusing keys for
     * uploads whose existing content must survive an interrupted upload. Defaults to `false`.
     *
     * Writes use a versioned storage format that older package versions cannot read. Upgrade all
     * processes sharing the directory before enabling this option. Migrated entries continue to use
     * atomic writes even if the option is later omitted or disabled; reads never migrate entries.
     * Callers must still coordinate overlapping operations. Power-loss durability is not guaranteed.
     */
    atomicWrites?: boolean;
}
/**
 * Creates a {@link FileStorage} that is backed by a filesystem directory using `node:fs`.
 *
 * Important: No attempt is made to avoid overwriting existing files, so the directory used should
 * be a new directory solely dedicated to this storage object.
 *
 * By default, replacing a legacy entry writes directly to its content file, so a failed write can
 * damage the previous content. Set `atomicWrites: true` to preserve the previous entry on failure.
 * Callers must coordinate overlapping reads, writes, removals, and listings across all instances
 * and processes sharing the directory. This includes consuming files returned by `get()` or
 * `put()` before allowing replacement or removal.
 *
 * Note: Keys have no correlation to file names on disk, so they may be any string including
 * characters that are not valid in file names. Additionally, individual `File` names have no
 * correlation to names of files on disk, so multiple files with the same name may be stored in the
 * same storage object.
 *
 * @param directory The directory where files are stored
 * @param options Storage options (defaults to non-atomic writes for new and legacy entries)
 * @returns A new {@link FileStorage} backed by a filesystem directory
 */
export declare function createFsFileStorage(directory: string, options?: FsFileStorageOptions): FileStorage<LazyFile>;
//# sourceMappingURL=fs.d.ts.map