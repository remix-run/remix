export type ModuleTracking = {
    trackedFiles: readonly string[];
    trackedDirectories?: readonly string[];
};
export type ModuleWatchEvent = 'change' | 'add' | 'unlink';
export type FileSnapshot = {
    mtimeNs: bigint;
    size: bigint;
};
export type ModuleSnapshot = ReadonlyMap<string, FileSnapshot>;
type ModuleLinksState = {
    acceptedDependencies: ReadonlySet<string>;
    dependencies: ReadonlySet<string>;
};
type ModuleRecordState<transformed, resolved, emitted> = {
    hmrUpdateTimestamp?: number;
    identityPath: string;
    invalidationVersion: number;
    transformed?: transformed;
    resolved?: resolved;
    lastResolved?: resolved;
    links: ModuleLinksState;
    emitted?: emitted;
    emittedSnapshot?: ModuleSnapshot;
    staleEmitted?: emitted;
    staleEmittedSnapshot?: ModuleSnapshot;
    trackedFiles: ReadonlySet<string>;
    trackedDirectories: ReadonlySet<string>;
};
export type ModuleRecord<transformed, resolved, emitted> = Readonly<ModuleRecordState<transformed, resolved, emitted>>;
export type ModuleStore<transformed, resolved, emitted> = {
    get(identityPath: string): ModuleRecord<transformed, resolved, emitted>;
    getAcceptedImporters(identityPath: string): ReadonlySet<string>;
    getHmrUpdateTimestamp(identityPath: string): number | undefined;
    getImporters(identityPath: string): ReadonlySet<string>;
    getLastResolved(identityPath: string): resolved | undefined;
    setHmrUpdateTimestamp(identityPath: string, timestamp: number): void;
    clearTransformed(identityPath: string, tracking: readonly ModuleTracking[]): void;
    setTransformed(identityPath: string, transformed: transformed, tracking: readonly ModuleTracking[]): void;
    setResolved(identityPath: string, resolved: resolved, tracking: readonly ModuleTracking[]): void;
    clearResolved(identityPath: string, tracking: readonly ModuleTracking[]): void;
    setEmitted(identityPath: string, emitted: emitted, snapshot: ModuleSnapshot | null): void;
    invalidateForFileEvent(filePath: string, event: ModuleWatchEvent): void;
    invalidateAll(): void;
};
export declare function createModuleStore<transformed, resolved, emitted>(options?: {
    getAcceptedDependencies?: (resolved: resolved) => readonly string[];
    getDependencies?: (resolved: resolved) => readonly string[];
    onWatchDirectoriesChange?: (delta: {
        add: string[];
        remove: string[];
    }) => void;
}): ModuleStore<transformed, resolved, emitted>;
export {};
//# sourceMappingURL=module-store.d.ts.map