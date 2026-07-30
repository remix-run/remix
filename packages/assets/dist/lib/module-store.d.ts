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
type ModuleRecordState<transformed, resolved, emitted> = {
    identityPath: string;
    invalidationVersion: number;
    transformed?: transformed;
    resolved?: resolved;
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
    clearTransformed(identityPath: string, tracking: readonly ModuleTracking[]): void;
    setTransformed(identityPath: string, transformed: transformed, tracking: readonly ModuleTracking[]): void;
    setResolved(identityPath: string, resolved: resolved, tracking: readonly ModuleTracking[]): void;
    clearResolved(identityPath: string, tracking: readonly ModuleTracking[]): void;
    setEmitted(identityPath: string, emitted: emitted, snapshot: ModuleSnapshot | null): void;
    invalidateForFileEvent(filePath: string, event: ModuleWatchEvent): void;
    invalidateAll(): void;
};
export declare function createModuleStore<transformed, resolved, emitted>(options?: {
    onWatchDirectoriesChange?: (delta: {
        add: string[];
        remove: string[];
    }) => void;
}): ModuleStore<transformed, resolved, emitted>;
export {};
//# sourceMappingURL=module-store.d.ts.map