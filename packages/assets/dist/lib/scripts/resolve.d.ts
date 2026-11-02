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
export type ResolvedImport = {
    compiledSpecifier: string;
    depPath: string;
    dynamic?: boolean;
    end: number;
    quote?: '"' | "'" | '`';
    scopePathname?: string;
    specifier: string;
    start: number;
};
type ResolvedHmrAcceptedDependency = ResolvedImport;
export type ResolvedModule = {
    deps: string[];
    hmr: Omit<TransformedModule['hmr'], 'acceptedDeps'> & {
        acceptedDeps: ResolvedHmrAcceptedDependency[];
    };
    identityPath: string;
    importRewrites: ImportRewrite[];
    imports: ResolvedImport[];
    packageJsonPath: string | null;
    trackedFiles: string[];
    rawCode: string;
    resolvedPath: string;
    runtimeImports: ResolvedImport[];
    sourceMap: string | null;
    staticDeps: string[];
    stableUrlPathname: string;
};
export type ImportRewrite = {
    end: number;
    imports: Array<{
        depPath: string;
        sourceStart: number;
        /** Empty when this rewrite only preserves the original module evaluation order. */
        specifiers: Array<{
            authoredImportedName: string;
            importedName: string;
            importedStart: number;
            localName: string;
            localStart: number;
        }>;
    }>;
    start: number;
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
    concurrency: number;
    isDirectoryResolutionFileIndependent(directory: string): boolean;
    isAllowed(absolutePath: string): boolean;
    isWatchIgnored(filePath: string): boolean;
    packageJsonSearchRoot: string;
    resolveModulePath(absolutePath: string): ResolveModuleResult | null;
    resolverFactory: ResolverFactory;
    resolveDirectorySpecifierIdentity(directory: string, specifier: string): Promise<string | null>;
    routes: CompiledRoutes;
};
export declare function resolveModule(record: ScriptRecord, transformed: TransformedModule, args: ResolveArgs): Promise<ResolveResult>;
export {};
//# sourceMappingURL=resolve.d.ts.map