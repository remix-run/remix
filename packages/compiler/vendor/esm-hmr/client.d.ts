/**
 * esm-hmr/client.ts
 * A client-side implementation of the ESM-HMR spec, for reference.
 */
declare type DisposeCallback = () => void;
declare type AcceptCallback = (args: {
    module: any;
    deps: any[];
}) => void;
declare type AcceptCallbackObject = {
    deps: string[];
    callback: AcceptCallback;
};
declare class HotModuleState {
    id: string;
    data: any;
    isLocked: boolean;
    isDeclined: boolean;
    isAccepted: boolean;
    acceptCallbacks: AcceptCallbackObject[];
    disposeCallbacks: DisposeCallback[];
    constructor(id: string);
    lock(): void;
    dispose(callback: DisposeCallback): void;
    invalidate(): void;
    decline(): void;
    accept(_deps: string[], callback?: true | AcceptCallback): void;
}
export declare function createHotContext(fullUrl: string): HotModuleState;
export {};
