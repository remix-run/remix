export interface ComponentHmrState {
    [key: string]: unknown;
}
export interface ComponentHmrRefresh {
    reconcileRoots(): void;
    setComponentStalenessCheck(check: (component: Function) => boolean): void;
}
type ComponentFunction = (...args: unknown[]) => unknown;
type ComponentHmrHandle = {
    signal: AbortSignal;
};
export declare function registerComponentForHmr(refresh: ComponentHmrRefresh, moduleUrl: string, componentName: string, implementation: ComponentFunction, setupHash: string, wrapper: Function): void;
export declare function getCurrentComponentForHmr(moduleUrl: string, componentName: string): ComponentFunction;
export declare function getComponentHandleForHmr(handle: unknown, moduleUrl: string, componentName: string): ComponentHmrHandle;
export declare function getComponentHmrState(handle: ComponentHmrHandle): ComponentHmrState;
export declare function setupComponentForHmr(handle: ComponentHmrHandle, state: ComponentHmrState, moduleUrl: string, componentName: string, setupHash: string, setup: (state: ComponentHmrState) => void, wrapper: Function): boolean;
export declare function clearComponentHmrState(handle: ComponentHmrHandle): void;
export declare function registerComponentRenderForHmr(refresh: ComponentHmrRefresh, moduleUrl: string, componentName: string, handle: ComponentHmrHandle, render: ComponentFunction, wrapper: Function): void;
export declare function callComponentRenderForHmr(handle: ComponentHmrHandle, ...args: unknown[]): unknown;
export declare function registerComponentInstanceForHmr(handle: ComponentHmrHandle, cleanup?: () => void): void;
export declare function updateComponentModuleForHmr(refresh: ComponentHmrRefresh, moduleUrl: string, module: object): void;
export {};
//# sourceMappingURL=browser-runtime.d.ts.map