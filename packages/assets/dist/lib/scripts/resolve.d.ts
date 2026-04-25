import type { ResolverFactory } from 'oxc-resolver';
import type { AssetServerCompilationError } from '../compilation-error.ts';
import type { CompiledRoutes } from '../routes.ts';
import type { ModuleRecord } from './store.ts';
import type { ResolveModuleResult, TransformedModule } from './transform.ts';
export declare const resolverExtensionAlias: {
    '.js': string[];
    '.jsx': string[];
    '.mjs': string[];
};
export declare const resolverExtensions: string[];
export declare const supportedScriptExtensions: string[];
type ResolvedImport = {
    depPath: string;
    end: number;
    quote?: '"' | "'" | '`';
    start: number;
};
type RelativeImportResolution = {
    candidatePaths: readonly string[];
    candidatePrefixes: readonly string[];
    specifier: string;
};
export type TrackedResolution = RelativeImportResolution & {
    resolvedIdentityPath: string | null;
};
export type ResolvedModule = {
    deps: string[];
    fingerprint: string | null;
    identityPath: string;
    imports: ResolvedImport[];
    trackedFiles: string[];
    trackedResolutions: TrackedResolution[];
    rawCode: string;
    resolvedPath: string;
    sourceMap: string | null;
    stableUrlPathname: string;
};
export type ResolutionFailureState = {
    trackedFiles: readonly string[];
    trackedResolutions: readonly TrackedResolution[];
};
type ResolveResult = {
    ok: true;
    value: ResolvedModule;
} | {
    ok: false;
    error: AssetServerCompilationError;
    tracking: ResolutionFailureState;
};
export type ResolveArgs = {
    isAllowed(absolutePath: string): boolean;
    isWatchIgnored(filePath: string): boolean;
    resolveModulePath(absolutePath: string): ResolveModuleResult | null;
    resolverFactory: ResolverFactory;
    routes: CompiledRoutes;
};
export declare function resolveModule(record: ModuleRecord, transformed: TransformedModule, args: ResolveArgs): Promise<ResolveResult>;
export {};
//# sourceMappingURL=resolve.d.ts.map