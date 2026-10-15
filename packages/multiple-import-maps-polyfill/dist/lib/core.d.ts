type ModuleNamespace = Record<string, unknown>;
export declare function importShim(id: string, opts?: string | ImportCallOptions, parentUrl?: string): Promise<ModuleNamespace>;
export declare function preloadShim(ids: string | readonly string[], parentUrl?: string): Promise<void>;
export declare const registerNativeModule: (url: string) => void;
export {};
//# sourceMappingURL=core.d.ts.map