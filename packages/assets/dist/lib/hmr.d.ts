export type HmrModule = Readonly<Record<string, unknown>> & {
    readonly [Symbol.toStringTag]: 'Module';
};
export interface RemixHotContext {
    readonly data: Record<string, unknown>;
    accept(callback?: (module: HmrModule) => void | Promise<void>): void;
    accept(dep: string, callback?: (module: HmrModule) => void | Promise<void>): void;
    accept(deps: readonly string[], callback?: (modules: HmrModule[]) => void | Promise<void>): void;
    dispose(callback: (data: Record<string, unknown>) => void | Promise<void>): void;
    invalidate(message?: string): void;
    on(event: string, callback: (data: unknown) => void | Promise<void>): void;
}
export type HmrPayload = {
    type: 'server:update';
} | {
    updates: Array<{
        acceptedPath?: string;
        path: string;
        type: 'js';
    } | {
        path: string;
        type: 'css';
    }>;
    timestamp: number;
    type: 'assets:update';
} | {
    path?: string;
    type: 'assets:full-reload';
};
export declare function createHmrClientSource(options: {
    eventPathname: string;
}): string;
//# sourceMappingURL=hmr.d.ts.map