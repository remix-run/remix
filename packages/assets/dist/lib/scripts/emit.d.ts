import type { ResolvedModule } from './resolve.ts';
import type { AssetServerCompilationError } from '../compilation-error.ts';
export type EmittedAsset = {
    content: string;
    etag: string;
};
export type EmittedModule = {
    code: EmittedAsset;
    fingerprint: string | null;
    importUrls: string[];
    sourceMap: EmittedAsset | null;
};
type EmitResult = {
    ok: true;
    value: EmittedModule;
} | {
    ok: false;
    error: AssetServerCompilationError;
};
export declare function emitResolvedModule(resolvedModule: ResolvedModule, options: {
    getServedUrl(identityPath: string): Promise<string>;
    sourceMaps?: 'external' | 'inline';
}): Promise<EmitResult>;
export {};
//# sourceMappingURL=emit.d.ts.map