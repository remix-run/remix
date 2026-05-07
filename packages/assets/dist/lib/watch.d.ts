import chokidar from 'chokidar';
type AssetServerWatcherOptions = {
    ignore?: readonly string[];
    onChokidarWatcherCreated?: (watcher: ChokidarWatcher) => void;
    poll?: boolean;
    pollInterval?: number;
    onFileEvent(filePath: string, event: AssetServerWatchEvent): Promise<void>;
    rootDir: string;
};
type AssetServerWatchEvent = 'add' | 'change' | 'unlink';
export type ChokidarWatcher = ReturnType<typeof chokidar.watch>;
export type AssetServerWatcher = {
    close(): Promise<void>;
    getWatchedTargets(): readonly string[];
    updateWatchedDirectories(delta: {
        add: readonly string[];
        remove: readonly string[];
    }): void;
};
export declare function createAssetServerWatcher(options: AssetServerWatcherOptions): AssetServerWatcher;
export {};
//# sourceMappingURL=watch.d.ts.map