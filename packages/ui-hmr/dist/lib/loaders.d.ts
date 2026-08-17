interface ServerModuleHooks {
    load: ServerModuleLoadHook;
}
type ServerModuleLoadHook = (url: string, context: ModuleLoadContext, nextLoad: NextServerModuleLoader) => ModuleLoadResult;
type NextServerModuleLoader = (url: string, context?: Partial<ModuleLoadContext>) => ModuleLoadNextResult;
type BrowserModuleLoader = (url: string, context: ModuleLoadContext, nextLoad: NextBrowserModuleLoader) => ModuleLoadResult;
type NextBrowserModuleLoader = (url: string, context?: Partial<ModuleLoadContext>) => ModuleLoadNextResult;
interface ModuleLoadContext {
    conditions: string[];
    format: string | null | undefined;
    importAttributes: Record<string, string | undefined>;
    moduleUrl?: string;
}
type ModuleFloat16Array = typeof globalThis extends {
    Float16Array: {
        prototype: infer array;
    };
} ? array : never;
type ModuleTypedArray = Uint8Array | Uint8ClampedArray | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array | BigUint64Array | BigInt64Array | ModuleFloat16Array | Float32Array | Float64Array;
type ModuleLoadSource = string | ArrayBuffer | ModuleTypedArray;
interface ModuleLoadResult {
    format: string | null | undefined;
    shortCircuit?: boolean;
    source?: ModuleLoadSource;
}
interface ModuleLoadNextResult {
    format: string | null | undefined;
    shortCircuit?: boolean;
    source?: ModuleLoadSource;
}
export declare function createAssetsUiHmrLoader(): BrowserModuleLoader;
export declare function createServerUiHmrModuleHooks(): ServerModuleHooks;
export {};
//# sourceMappingURL=loaders.d.ts.map