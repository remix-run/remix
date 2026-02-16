import type { FileStorage } from '../file-storage.ts';
/**
 * Creates a `FileStorage` that is backed by a filesystem directory using node:fs.
 *
 * Important: No attempt is made to avoid overwriting existing files, so the directory used should
 * be a new directory solely dedicated to this storage object.
 *
 * Note: Keys have no correlation to file names on disk, so they may be any string including
 * characters that are not valid in file names. Additionally, individual `File` names have no
 * correlation to names of files on disk, so multiple files with the same name may be stored in the
 * same storage object.
 *
 * @param directory The directory where files are stored
 * @returns A new file storage backed by a filesystem directory
 */
export declare function createFsFileStorage(directory: string): FileStorage;
//# sourceMappingURL=fs.d.ts.map