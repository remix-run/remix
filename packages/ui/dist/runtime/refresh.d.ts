import type { VirtualRoot } from './vdom.ts';
/**
 * Reports whether an existing component instance must remount instead of reconciling during a
 * development refresh.
 *
 * @param type Component function being considered for reuse.
 * @returns `true` when existing instances must be remounted.
 */
export type ComponentStalenessCheck = (type: Function) => boolean;
export declare let componentStalenessCheck: ComponentStalenessCheck | null;
/**
 * Installs the process-wide component compatibility check used during development refreshes.
 *
 * When the check returns `true`, reconciliation replaces existing instances of that component
 * instead of preserving their state. This is a low-level integration point for HMR runtimes.
 *
 * @param check Callback that returns `true` when instances of a component must be remounted.
 */
export declare function setComponentStalenessCheck(check: ComponentStalenessCheck): void;
export declare function registerRoot(root: VirtualRoot): void;
export declare function unregisterRoot(root: VirtualRoot): void;
/**
 * Immediately schedules reconciliation for every active Remix UI root using its current element.
 *
 * HMR runtimes call this after installing updated component implementations so mounted trees render
 * the new code while preserving compatible component state.
 */
export declare function reconcileRoots(): void;
