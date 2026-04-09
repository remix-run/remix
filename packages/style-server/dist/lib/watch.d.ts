import type { StyleRouteDefinition } from './routes.ts';
type StyleServerWatcherOptions = {
    ignore?: readonly string[];
    poll?: boolean;
    pollInterval?: number;
    onFileEvent(filePath: string, event: StyleServerWatchEvent): Promise<void>;
    root: string;
    routes: readonly StyleRouteDefinition[];
};
type StyleServerWatchEvent = 'add' | 'change' | 'unlink';
export type StyleServerWatcher = {
    close(): Promise<void>;
    getWatchedDirectories(): string[];
    whenReady(): Promise<void>;
};
export declare function createStyleServerWatcher(options: StyleServerWatcherOptions): StyleServerWatcher;
export {};
//# sourceMappingURL=watch.d.ts.map