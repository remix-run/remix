import type { TsConfigJsonResolved } from 'get-tsconfig';
import type { AssetServerCompilationError } from '../compilation-error.ts';
import type { ModuleRecord, ModuleTracking } from '../module-store.ts';
import type { CompiledRoutes } from '../routes.ts';
import type { EmittedModule } from './emit.ts';
import type { ResolvedScriptTarget } from '../target.ts';
import type { ResolvedModule } from './resolve.ts';
type ScriptRecord = ModuleRecord<TransformedModule, ResolvedModule, EmittedModule>;
export type ResolveModuleResult = {
    identityPath: string;
    resolvedPath: string;
};
type UnresolvedImport = {
    end: number;
    quote?: '"' | "'" | '`';
    specifier: string;
    start: number;
};
export type TransformedModule = {
    fingerprint: string | null;
    identityPath: string;
    importerDir: string;
    packageSpecifiers: string[];
    rawCode: string;
    resolvedPath: string;
    sourceMap: string | null;
    stableUrlPathname: string;
    trackedFiles: string[];
    unresolvedImports: UnresolvedImport[];
};
type TransformResult = {
    tracking: ModuleTracking;
} & ({
    ok: true;
    value: TransformedModule;
} | {
    ok: false;
    error: AssetServerCompilationError;
});
type TsconfigTransformOptions = {
    trackedFiles: string[];
    tsconfigRaw?: TsConfigJsonResolved;
};
type TsconfigTransformOptionsResolver = ReturnType<typeof createTsconfigTransformOptionsResolver>;
export type TransformArgs = {
    buildId: string | null;
    define: Record<string, string> | null;
    externalSet: ReadonlySet<string>;
    isWatchIgnored(filePath: string): boolean;
    minify: boolean;
    resolveActualPath(identityPath: string): string | null;
    routes: CompiledRoutes;
    sourceMapSourcePaths: 'absolute' | 'url';
    sourceMaps: 'external' | 'inline' | null;
    target: ResolvedScriptTarget | null;
    tsconfigTransformOptionsResolver: TsconfigTransformOptionsResolver;
};
export declare function createTsconfigTransformOptionsResolver(): {
    clear(): void;
    getTransformOptions(filePath: string, isWatchIgnored: (filePath: string) => boolean): TsconfigTransformOptions;
};
export declare function transformModule(record: ScriptRecord, args: TransformArgs): Promise<TransformResult>;
export {};
//# sourceMappingURL=transform.d.ts.map