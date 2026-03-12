import type { SessionStorage } from '@remix-run/session';
export interface RedisSessionStorageClient {
    get(key: string): Promise<string | null> | string | null;
    set(key: string, value: string): Promise<unknown> | unknown;
    del(key: string): Promise<unknown> | unknown;
    setEx?(key: string, ttlSeconds: number, value: string): Promise<unknown> | unknown;
    expire?(key: string, ttlSeconds: number): Promise<unknown> | unknown;
}
export interface RedisSessionStorageOptions {
    /**
     * Prefix for session keys in Redis.
     *
     * @default 'session:'
     */
    keyPrefix?: string;
    /**
     * Session TTL in seconds. If set, the session key expires automatically.
     *
     * @default undefined
     */
    ttl?: number;
    /**
     * Whether to reuse session IDs sent from the client that are not found in storage.
     *
     * @default false
     */
    useUnknownIds?: boolean;
}
/**
 * Creates a session storage backed by Redis.
 *
 * @param client Redis client with get/set/del methods
 * @param options Session storage options
 * @returns The session storage
 */
export declare function createRedisSessionStorage(client: RedisSessionStorageClient, options?: RedisSessionStorageOptions): SessionStorage;
//# sourceMappingURL=redis-storage.d.ts.map