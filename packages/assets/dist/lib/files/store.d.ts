export type FileSnapshot = {
    filePath: string;
    mtimeNs: bigint;
    size: bigint;
};
export type SourceFileMetadata = {
    contentType: string;
    etag: string;
    extension: string;
    fingerprint: string | null;
};
type SourceFileRecordState = {
    metadata?: SourceFileMetadata;
    metadataSnapshot?: FileSnapshot;
    identityPath: string;
    invalidationVersion: number;
    staleMetadata?: SourceFileMetadata;
    staleMetadataSnapshot?: FileSnapshot;
    watchedDirectory: string;
};
export type SourceFileRecord = Readonly<SourceFileRecordState>;
export type SourceFileStore = {
    get(identityPath: string): SourceFileRecord;
    invalidate(identityPath: string, options?: {
        retainStale: boolean;
    }): void;
    invalidateForFileEvent(filePath: string, event: 'add' | 'change' | 'unlink'): void;
    set(identityPath: string, metadata: SourceFileMetadata, snapshot: FileSnapshot | null): void;
};
export declare function createSourceFileStore(options?: {
    onWatchDirectoriesChange?: (delta: {
        add: string[];
        remove: string[];
    }) => void;
}): SourceFileStore;
export {};
//# sourceMappingURL=store.d.ts.map