import type { JobStorage } from '@remix-run/job/storage';
export interface RedisJobStorageClient {
    /**
     * Sends a raw Redis command and returns the decoded result.
     */
    sendCommand(command: string[]): Promise<unknown>;
}
export interface RedisJobStorageOptions {
    /**
     * Prefix applied to all Redis keys managed by the storage. Defaults to `"job:"`.
     */
    prefix?: string;
}
/**
 * Creates a Redis-backed `JobStorage` implementation.
 *
 * @param redis Redis client or compatible adapter used to execute commands
 * @param options Optional storage configuration
 * @returns A `JobStorage` that persists jobs in Redis
 */
export declare function createRedisJobStorage(redis: RedisJobStorageClient, options?: RedisJobStorageOptions): JobStorage;
//# sourceMappingURL=storage.d.ts.map