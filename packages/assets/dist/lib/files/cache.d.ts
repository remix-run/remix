import type { FileStorage } from '@remix-run/file-storage';
export interface TransformCacheKey {
    digest: string;
    slot: string;
}
interface CachedTransform {
    body: Uint8Array;
    extension: string;
}
export declare function isTransformCacheable(output: CachedTransform): boolean;
export declare function createTransformCacheKey(namespace: string, identity: string): Promise<TransformCacheKey>;
export declare function readCachedTransform(cache: FileStorage, key: TransformCacheKey): Promise<CachedTransform | null>;
export declare function writeCachedTransform(cache: FileStorage, key: TransformCacheKey, output: CachedTransform): Promise<void>;
export {};
//# sourceMappingURL=cache.d.ts.map