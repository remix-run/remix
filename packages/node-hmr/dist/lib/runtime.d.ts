import { type BrowserHmrChannel, type BrowserHmrFileEvent } from './browser-events.ts';
/**
 * Hot module context available at `import.meta.hot`.
 */
export interface ImportMetaHot {
    /** Mutable state preserved for this module across accepted updates and passed to dispose handlers. */
    readonly data: Record<string, unknown>;
    /** Accepts updates to this module, optionally receiving its newly evaluated namespace. */
    accept(callback?: (module: HotModule) => HotCallbackResult): void;
    /** Accepts updates from one dependency, optionally receiving its newly evaluated namespace. */
    accept(dep: string, callback?: (module: HotModule) => HotCallbackResult): void;
    /**
     * Accepts updates from multiple dependencies. The callback array preserves `deps` order and
     * contains the updated namespace only at the position of the dependency that changed.
     */
    accept(deps: readonly string[], callback?: (modules: Array<HotModule | undefined>) => HotCallbackResult): void;
    /** Registers cleanup that runs before this module is re-evaluated or the runtime is disposed. */
    dispose(callback: (data: Record<string, unknown>) => HotCallbackResult): void;
    /** Declines the current update and asks the runner to restart the child process. */
    invalidate(message?: string): void;
    /** Registers a custom-event listener for API compatibility. Server modules receive no events. */
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