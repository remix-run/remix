export interface MemcacheClient {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, ttlSeconds: number) => Promise<void>;
    delete: (key: string) => Promise<void>;
}
export declare function createMemcacheClient(server: string): MemcacheClient;
//# sourceMappingURL=memcache-client.d.ts.map