import { type ResolvedScriptRoot } from './path-utils.ts';
export interface ModuleCompileResult {
    compiledCode: string;
    compiledHash: string;
    sourceStamp: string;
    sourcemap: string | null;
    deps: string[];
}
interface RawModule {
    absolutePath: string;
    rawCode: string;
    sourcemap: string | null;
    sourceMapHash: string;
    sourceStamp: string;
    sourceText: string;
    deps: string[];
    imports: Array<{
        start: number;
        end: number;
        depPath: string;
        specifier: string;
    }>;
}
interface ModuleGraphOptions {
    base: string;
    roots: readonly ResolvedScriptRoot[];
    external: string[];
    sourceMaps: 'inline' | 'external' | undefined;
    sourceMapSourcePaths: 'virtual' | 'absolute';
    /** Returns true if the given absolute path is a configured entry point */
    isEntryPoint: (absolutePath: string) => boolean;
}
export interface ModuleGraphStore {
    raw: Map<string, RawModule>;
    rawInFlight: Map<string, Promise<RawModule>>;
    compiled: Map<string, ModuleCompileResult>;
    publicPaths: Map<string, string | null>;
    clear(): void;
    get(p: string): ModuleCompileResult | undefined;
}
export declare function createModuleGraphStore(): ModuleGraphStore;
export declare function buildGraph(absolutePath: string, store: ModuleGraphStore, opts: ModuleGraphOptions): Promise<ModuleCompileResult>;
export declare function collectTransitiveDeps(absolutePath: string, store: ModuleGraphStore): Array<[string, ModuleCompileResult]>;
export declare function isCompiledGraphFresh(absolutePath: string, store: ModuleGraphStore): Promise<boolean>;
export {};
//# sourceMappingURL=module-graph.d.ts.map