import { type BrowserHmrChannel, type BrowserHmrFileEvent } from './browser-events.ts';
/**
 * Hot module context available at `import.meta.hot`.
 */
export interface ImportMetaHot {
    /** State object preserved across accepted updates for this module. */
    readonly data: Record<string, unknown>;
    /** Accepts updates to the current module. */
    accept(callback?: (module: HotModule) => HotCallbackResult): void;
    /** Accepts updates from a dependency module. */
    accept(dep: string, callback?: (module: HotModule) => HotCallbackResult): void;
    /** Accepts updates from one or more dependency modules. */
    accept(deps: readonly string[], callback?: (modules: Array<HotModule | undefined>) => HotCallbackResult): void;
    /** Registers cleanup to run before this module is replaced or disposed. */
    dispose(callback: (data: Record<string, unknown>) => HotCallbackResult): void;
    /** Invalidates this update and asks the runner to restart the process. */
    invalidate(message?: string): void;
    /** Listens for custom HMR events. */
    on(event: string, callback: (data: unknown) => void | Promise<void>): void;
}
type HotModule = Readonly<Record<string, unknown>> & {
    readonly [Symbol.toStringTag]: 'Module';
};
export interface RemixNodeHmrRuntime {
    createBrowserHmrChannel(): Promise<BrowserHmrChannel>;
    createHotContext(url: string, resolveDependency?: (specifier: string) => string): ImportMetaHot;
    disposeAll(): Promise<void>;
    emitServerReady(): void;
    handleBrowserHmrFileEvents(requestId: number, events: readonly BrowserHmrFileEvent[]): void;
    reportAcceptedDependencies(url: string, acceptedDeps: string[]): void;
    update(url: string, timestamp: number, acceptedUrl?: string): Promise<void>;
}
type HotCallbackResult = void | Promise<void>;
export declare function getNodeHmrRuntime(): RemixNodeHmrRuntime | undefined;
/**
 * Notifies the parent process that the child server is ready.
 */
export declare function emitServerReady(): void;
export declare function installNodeHmrRuntime(options?: {
    browserEventUrl?: string;
}): RemixNodeHmrRuntime;
export {};
//# sourceMappingURL=runtime.d.ts.map