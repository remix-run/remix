import { TypedEventTarget } from '@remix-run/interaction';
/**
 * Options for hydrate()
 */
export interface HydrationRootOptions {
    /**
     * Custom module loader. Defaults to dynamic import.
     * @param moduleUrl The URL of the module to load
     * @param exportName The name of the export to retrieve
     * @returns The component function
     */
    loadModule?: (moduleUrl: string, exportName: string) => Promise<Function> | Function;
}
/**
 * Event map for hydration root
 */
export type HydrationRootEventMap = {
    error: ErrorEvent;
};
/**
 * Hydration root that manages all hydrated components
 */
export type HydrationRoot = TypedEventTarget<HydrationRootEventMap> & {
    /**
     * Promise that resolves when all modules are loaded and hydration is complete
     */
    ready: Promise<void>;
    /**
     * Synchronously flush all pending updates across all hydrated roots
     */
    flush(): void;
};
/**
 * Hydrate all components marked with `hydrationRoot()` in the document.
 *
 * This function:
 * 1. Finds the rmx-data script containing hydration metadata
 * 2. Discovers all hydration markers in the DOM
 * 3. Loads all component modules in parallel
 * 4. Hydrates each region by creating virtual roots
 *
 * The returned root is an EventTarget that receives error events from all
 * hydrated components.
 *
 * @param options Hydration options
 * @returns A HydrationRoot with `ready` promise, `flush()` method, and event handling
 * @example
 * ```ts
 * let root = hydrate()
 *
 * // Listen for errors from any hydrated component
 * root.addEventListener('error', (event) => {
 *   console.error('Hydration error:', event.error)
 * })
 *
 * await root.ready
 * root.flush()
 * ```
 */
export declare function hydrate(options?: HydrationRootOptions): HydrationRoot;
export type { HydrationRootOptions as HydrateOptions, HydrationRoot as HydrateResult };
