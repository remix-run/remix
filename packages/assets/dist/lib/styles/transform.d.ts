import type { ModuleTracking } from '../module-store.ts';
import type { AssetServerCompilationError } from '../compilation-error.ts';
import type { CompiledRoutes } from '../routes.ts';
import type { ResolvedStyleTarget } from '../target.ts';
type TransformedStyleDependency = {
    placeholder: string;
    type: 'import';
    url: string;
} | {
    placeholder: string;
    type: 'url';
    url: string;
};
export type TransformedStyle = {
    fingerprint: string | null;
    identityPath: string;
    rawCode: string;
    resolvedPath: string;
    sourceMap: string | null;
    stableUrlPathname: string;
    trackedFiles: string[];
    unresolvedDependencies: TransformedStyleDependency[];
};
type TransformResult = {
    tracking: ModuleTracking;
} & ({
    ok: true;
    value: TransformedStyle;
} | {
    error: AssetServerCompilationError;
    ok: false;
});
export type TransformArgs = {
    buildId: string | null;
    isWatchIgnored(filePath: string): boolean;
    minify: boolean;
    routes: CompiledRoutes;
    sourceMaps: 'external' | 'inline' | null;
    sourceMapSourcePaths: 'absolute' | 'url';
    targets: ResolvedStyleTarget | null;
};
type TransformRecord = {
    identityPath: string;
};
export declare function transformStyle(record: TransformRecord, args: TransformArgs): Promise<TransformResult>;
export {};
//# sourceMappingURL=transform.d.ts.map