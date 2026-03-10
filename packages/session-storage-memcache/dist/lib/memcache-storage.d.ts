import type { SessionStorage } from '@remix-run/session';
export interface MemcacheSessionStorageOptions {
    /**
     * Whether to reuse session IDs sent from the client that are not found in storage.
     * Default is `false`.
     */
    useUnknownIds?: boolean;
    /**
     * Prefix prepended to all session keys in Memcache.
     * Default is `'remix:session:'`.
     */
    keyPrefix?: string;
    /**
     * Session TTL in seconds.
     * Default is `0` (never expire).
     */
    ttlSeconds?: number;
}
/**
 * Creates a session storage that stores all session data in Memcache.
 *
 * Note: This storage requires a Node.js runtime with TCP socket support.
 *
 * @param server The Memcache server in `host:port` format
 * @param options (optional) The options for the session storage
 * @returns The session storage
 */
export declare function createMemcacheSessionStorage(server: string, options?: MemcacheSessionStorageOptions): SessionStorage;
//# sourceMappingURL=memcache-storage.d.ts.map