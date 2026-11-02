export interface ModuleRecord {
    filePath: string;
    hmr: {
        acceptedDeps: string[];
        selfAccepting: boolean;
        usesImportMetaHot: boolean;
    };
    url: string;
}
export interface HotUpdateBoundary {
    acceptedDependencyUrl: string;
    invalidatedUrls: Record<string, number>;
    updateHandlerUrl: string;
}
export interface ModuleStore {
    addDependency(importerUrl: string, dependencyUrl: string): void;
    findHotUpdateBoundaries(url: string, timestamp: number): HotUpdateBoundary[] | null;
    findHotUpdateBoundariesFromImporters(url: string, timestamp: number): HotUpdateBoundary[] | null;
    getModule(url: string): ModuleRecord | undefined;
    getModulesForFile(filePath: string): readonly ModuleRecord[];
    getReachableFilePaths(entryUrl: string): ReadonlySet<string>;
    reset(): void;
    setAcceptedDependencies(url: string, acceptedDependencies: string[]): void;
    setModule(module: ModuleRecord): void;
}
export declare function createModuleStore(): ModuleStore;
//# sourceMappingURL=module-store.d.ts.map