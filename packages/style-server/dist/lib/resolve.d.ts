import { type StyleServerCompilationError } from './compilation-error.ts';
import type { CompiledRoutes } from './routes.ts';
import type { StyleRecord } from './store.ts';
import type { TransformedStyle } from './transform.ts';
export type ResolveArgs = {
    isAllowed(absolutePath: string): boolean;
    routes: CompiledRoutes;
};
type ResolvedDependency = {
    dependencyType: 'import' | 'url';
    kind: 'external';
    placeholder: string;
    replacement: string;
} | {
    depPath: string;
    dependencyType: 'import' | 'url';
    kind: 'local';
    placeholder: string;
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
export type ResolutionFailureState = {
    trackedFiles: readonly string[];
};
type ResolveResult = {
    ok: true;
    value: ResolvedStyle;
} | {
    error: StyleServerCompilationError;
    ok: false;
    tracking: ResolutionFailureState;
};
export declare function resolveStyle(record: StyleRecord, transformed: TransformedStyle, args: ResolveArgs): Promise<ResolveResult>;
export declare function resolveServedFileOrThrow(filePath: string, args: ResolveArgs): {
    identityPath: string;
    stableUrlPathname: string;
};
export {};
//# sourceMappingURL=resolve.d.ts.map