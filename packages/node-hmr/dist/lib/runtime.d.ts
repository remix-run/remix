import { type BrowserEventChannel } from './browser-events.ts';
export interface RemixNodeHotContext {
    readonly data: Record<string, unknown>;
    accept(callback?: (module: HmrModule) => HotCallbackResult): void;
    accept(dep: string, callback?: (module: HmrModule) => HotCallbackResult): void;
    accept(deps: readonly string[], callback?: (modules: HmrModule[]) => HotCallbackResult): void;
    dispose(callback: (data: Record<string, unknown>) => HotCallbackResult): void;
    invalidate(message?: string): void;
    on(event: string, callback: (data: unknown) => void | Promise<void>): void;
}
export type HmrModule = Readonly<Record<string, unknown>> & {
    readonly [Symbol.toStringTag]: 'Module';
};
export interface RemixNodeHmrRuntime {
    readonly browserEventChannel: BrowserEventChannel | undefined;
    createHotContext(url: string, resolveDependency?: (specifier: string) => string): RemixNodeHotContext;
    disposeAll(): Promise<void>;
    reportAcceptedDependencies(url: string, acceptedDeps: string[]): void;
    update(url: string, timestamp: number, acceptedUrl?: string): Promise<void>;
}
type HotCallbackResult = void | Promise<void>;
export declare function getNodeHmrRuntime(): RemixNodeHmrRuntime | undefined;
export declare function installNodeHmrRuntime(options?: {
    browserEventUrl?: string;
}): RemixNodeHmrRuntime;
export {};
//# sourceMappingURL=runtime.d.ts.map