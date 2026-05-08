import type { AssetServerCompilationError } from '../compilation-error.ts';
import type { ResolvedStyle } from './resolve.ts';
export type EmittedAsset = {
    content: string;
    etag: string;
};
export type EmittedStyle = {
    code: EmittedAsset;
    fingerprint: string | null;
    importUrls: string[];
    sourceMap: EmittedAsset | null;
};
type EmitResult = {
    ok: true;
    value: EmittedStyle;
} | {
    error: AssetServerCompilationError;
    ok: false;
};
export declare function emitResolvedStyle(resolvedStyle: ResolvedStyle, options: {
    getServedUrl(identityPath: string): Promise<string>;
    sourceMaps?: 'external' | 'inline';
}): Promise<EmitResult>;
export {};
//# sourceMappingURL=emit.d.ts.map