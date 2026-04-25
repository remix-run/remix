import type { EmittedModule } from './emit.ts';
import type { ResolutionFailureState, ResolvedModule, TrackedResolution } from './resolve.ts';
import type { TransformFailureState, TransformedModule } from './transform.ts';
export type ModuleWatchEvent = 'change' | 'add' | 'unlink';
export type FileSnapshot = {
    mtimeNs: bigint;
    size: bigint;
};
export type ModuleSnapshot = ReadonlyMap<string, FileSnapshot>;
type ModuleRecordState = {
    identityPath: string;
    invalidationVersion: number;
    transformed?: TransformedModule;
    resolved?: ResolvedModule;
    emitted?: EmittedModule;
    emittedSnapshot?: ModuleSnapshot;
    staleEmitted?: EmittedModule;
    staleEmittedSnapshot?: ModuleSnapshot;
    trackedFiles: ReadonlySet<string>;
    trackedResolutions: readonly TrackedResolution[];
};
export type ModuleRecord = Readonly<ModuleRecordState>;
type ModuleStore = {
    get(identityPath: string): ModuleRecord;
    setTransformFailure(identityPath: string, failure: TransformFailureState): void;
    setTransformed(identityPath: string, transformed: TransformedModule): void;
    setResolved(identityPath: string, resolved: ResolvedModule): void;
    setResolveFailure(identityPath: string, failure: ResolutionFailureState): void;
    setEmitted(identityPath: string, emitted: EmittedModule, snapshot: ModuleSnapshot | null): void;
    invalidateForFileEvent(filePath: string, event: ModuleWatchEvent): void;
    invalidateAll(): void;
};
export declare function createModuleStore(options?: {
    onWatchDirectoriesChange?: (delta: {
        add: string[];
        remove: string[];
    }) => void;
}): ModuleStore;
export {};
//# sourceMappingURL=store.d.ts.map