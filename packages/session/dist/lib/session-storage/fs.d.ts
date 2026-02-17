import type { SessionStorage } from '../session-storage.ts';
export interface FsSessionStorageOptions {
    /**
     * Whether to reuse session IDs sent from the client that are not found in storage.
     * Default is `false`.
     */
    useUnknownIds?: boolean;
}
/**
 * Creates a session storage that stores all session data in a filesystem directory using
 * Node's fs module.
 *
 * Note: No attempt is made to avoid overwriting existing files, so the directory used should
 * be a new directory solely dedicated to this storage object.
 *
 * @param directory The directory to store the session files in
 * @param options (optional) The options for the session storage
 * @returns The session storage
 */
export declare function createFsSessionStorage(directory: string, options?: FsSessionStorageOptions): SessionStorage;
//# sourceMappingURL=fs.d.ts.map