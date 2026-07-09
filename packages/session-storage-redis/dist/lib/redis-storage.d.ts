import type { SessionStorage } from '@remix-run/session';
/**
 * Minimal Redis client contract required by {@link createRedisSessionStorage}.
 */
export interface RedisSessionStorageClient {
    /**
     * Reads a serialized session value.
     */
    get(key: string): Promise<string | null> | string | null;
    /**
     * Stores a serialized session value.
     */
    set(key: string, value: string): Promise<unknown> | unknown;
    /**
     * Deletes a stored session value.
     */
    del(key: string): Promise<unknown> | unknown;
    /**
     * Stores a serialized session value with a TTL in seconds.
     */
    setEx?(key: string, ttlSeconds: number, value: string): Promise<unknown> | unknown;
    /**
     * Updates the TTL for an existing session value in seconds.
     */
    expire?(key: string, ttlSeconds: number): Promise<unknown> | unknown;
}
/**
 * Options for Redis-backed session storage created by {@link createRedisSessionStorage}.
 */
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