import type { SessionStorage } from '../session-storage.ts';
export interface MemorySessionStorageOptions {
    /**
     * Whether to reuse session IDs sent from the client that are not found in storage.
     * Default is `false`.
     */
    useUnknownIds?: boolean;
}
/**
 * Creates a session storage that stores all session data in memory.
 *
 * Note: This is useful for testing and development. All session data is lost when the
 * server restarts.
 *
 * @param options The options for the session storage
 * @returns The session storage
 */
export declare function createMemorySessionStorage(options?: MemorySessionStorageOptions): SessionStorage;
//# sourceMappingURL=memory.d.ts.map