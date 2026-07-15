interface ModuleHooks {
    load?: ModuleLoadHook;
}
interface BrowserModuleHooks {
    load?: BrowserModuleLoadHook;
}
type ModuleLoadHook = (url: string, context: ModuleLoadContext, nextLoad: ModuleLoadHookNext) => ModuleLoadResult;
type ModuleLoadHookNext = (url: string, context?: Partial<ModuleLoadContext>) => ModuleLoadNextResult;
type BrowserModuleLoadHook = (url: string, context: ModuleLoadContext, nextLoad: BrowserModuleLoadHookNext) => ModuleLoadResult;
type BrowserModuleLoadHookNext = (url: string, context?: Partial<ModuleLoadContext>) => ModuleLoadNextResult;
interface ModuleLoadContext {
    conditions: string[];
    format: string | null | undefined;
    importAttributes: Record<string, string | undefined>;
    moduleUrl?: string;
}
interface ModuleLoadResult {
    format: string | null | undefined;
    shortCircuit?: boolean;
    source?: string | ArrayBuffer | NodeJS.TypedArray;
}
interface ModuleLoadNextResult {
    format: string | null | undefined;
    shortCircuit?: boolean;
    source?: string | ArrayBuffer | NodeJS.TypedArray;
}
export declare function createBrowserUiHmrModuleHooks(): BrowserModuleHooks;
export declare function createServerUiHmrModuleHooks(): ModuleHooks;
export {};
//# sourceMappingURL=module-hooks.d.ts.map