import type { ResolverFactory } from 'oxc-resolver';
import type { AssetServerCompilationError } from '../compilation-error.ts';
import type { ModuleRecord, ModuleTracking } from '../module-store.ts';
import type { CompiledRoutes } from '../routes.ts';
import type { ResolveModuleResult, TransformedModule } from './transform.ts';
import type { EmittedModule } from './emit.ts';
type ScriptRecord = ModuleRecord<TransformedModule, ResolvedModule, EmittedModule>;
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
export type ResolvedModule = {
    deps: string[];
    fingerprint: string | null;
    identityPath: string;
    imports: ResolvedImport[];
    trackedFiles: string[];
    rawCode: string;
    resolvedPath: string;
    sourceMap: string | null;
    stableUrlPathname: string;
};
type ResolveResult = {
    tracking: ModuleTracking;
} & ({
    ok: true;
    value: ResolvedModule;
} | {
    ok: false;
    error: AssetServerCompilationError;
});
export type ResolveArgs = {
    isAllowed(absolutePath: string): boolean;
    isWatchIgnored(filePath: string): boolean;
    resolveModulePath(absolutePath: string): ResolveModuleResult | null;
    resolverFactory: ResolverFactory;
    routes: CompiledRoutes;
};
export declare function resolveModule(record: ScriptRecord, transformed: TransformedModule, args: ResolveArgs): Promise<ResolveResult>;
export {};
//# sourceMappingURL=resolve.d.ts.map