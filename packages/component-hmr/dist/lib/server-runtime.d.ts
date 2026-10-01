type ComponentFunction = (...args: unknown[]) => unknown;
export declare function registerComponentForHmr(moduleUrl: string, componentName: string, implementation: ComponentFunction): void;
export declare function getCurrentComponentForHmr(moduleUrl: string, componentName: string): ComponentFunction;
export {};
//# sourceMappingURL=server-runtime.d.ts.map