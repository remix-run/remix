import { type BrowserHmrFileEvent } from './browser-events.ts';
export declare function normalizeBrowserHmrFilePath(filePath: string): string;
export declare function getBrowserHmrFileEventsForWatchedFiles(options: {
    changedPaths: readonly string[];
    restartPathEvents: ReadonlyMap<string, 'add' | 'unlink'>;
    watchedFiles: ReadonlySet<string>;
}): BrowserHmrFileEvent[];
export declare function getWatchedDirectoriesForFiles(filePaths: Iterable<string>): Set<string>;
interface BrowserHmrChannelOptions {
    host?: string;
    port?: number;
    pathname?: string;
}
interface NodeHmrWatchOptions {
    ignore?: readonly string[];
    poll?: boolean;
    pollInterval?: number;
}
interface ResolvedChokidarWatchOptions {
    awaitWriteFinish: {
        pollInterval: number;
        stabilityThreshold: number;
    };
    depth: number;
    ignorePermissionErrors: boolean;
    ignored: string[];
    ignoreInitial: boolean;
    interval: number;
    usePolling: boolean;
}
export declare function createWatchedProcessController(options: {
    browserHmrChannel: BrowserHmrChannelOptions | null;
    cwd: string;
    entry: string;
    entryArgs: string[];
    env: NodeJS.ProcessEnv;
    nodeArgs: string[];
    registerPath: string;
    watch?: NodeHmrWatchOptions;
}): {
    readonly generation: number;
    ready(): Promise<void>;
    start(): Promise<void>;
    stop(signal?: NodeJS.Signals): Promise<void>;
};
export declare function resolveChokidarWatchOptions(options?: NodeHmrWatchOptions): ResolvedChokidarWatchOptions;
export declare function buildChildProcessArgs(options: {
    browserEventUrl?: string;
    entry: string;
    entryArgs: Array<string>;
    nodeArgs: Array<string>;
    registerPath: string;
    rootPath?: string;
}): Array<string>;
export declare function buildChildProcessEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
export {};
//# sourceMappingURL=runner.d.ts.map