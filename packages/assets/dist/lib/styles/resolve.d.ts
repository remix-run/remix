import type { AssetServerCompilationError } from '../compilation-error.ts';
import type { ModuleRecord, ModuleTracking } from '../module-store.ts';
import type { CompiledRoutes } from '../routes.ts';
import type { EmittedStyle } from './emit.ts';
import type { TransformedStyle } from './transform.ts';
type StyleRecord = ModuleRecord<TransformedStyle, ResolvedStyle, EmittedStyle>;
type ResolvedDependency = {
    kind: 'external';
    placeholder: string;
    replacement: string;
} | {
    depPath: string;
    kind: 'file' | 'style';
    placeholder: string;
    requestTransform: readonly string[] | null;
    suffix: string;
};
export type ResolvedStyle = {
    dependencies: ResolvedDependency[];
    deps: string[];
    fingerprint: string | null;
    identityPath: string;
    rawCode: string;
    resolvedPath: string;
    sourceMap: string | null;
    stableUrlPathname: string;
    trackedFiles: string[];
};
export type ResolveArgs = {
    isAllowed(absolutePath: string): boolean;
    isServedFilePath(filePath: string): boolean;
    isWatchIgnored(filePath: string): boolean;
    routes: CompiledRoutes;
};
type ResolveResult = {
    tracking: ModuleTracking;
} & ({
    ok: true;
    value: ResolvedStyle;
} | {
    error: AssetServerCompilationError;
    ok: false;
});
export declare function resolveStyle(record: StyleRecord, transformed: TransformedStyle, args: ResolveArgs): Promise<ResolveResult>;
export declare function resolveServedStyleOrThrow(filePath: string, args: ResolveArgs): {
    identityPath: string;
    stableUrlPathname: string;
};
export {};
//# sourceMappingURL=resolve.d.ts.map