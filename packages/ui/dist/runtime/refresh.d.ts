import type { VirtualRoot } from './vdom.ts';
/**
 * Checks whether a component should be treated as stale during HMR reconciliation.
 */
export type ComponentStalenessCheck = (type: Function) => boolean;
export declare let componentStalenessCheck: ComponentStalenessCheck | null;
/**
 * Installs the component staleness check used by HMR runtimes.
 *
 * @param check Callback that reports whether a component is stale.
 */
export declare function setComponentStalenessCheck(check: ComponentStalenessCheck): void;
export declare function registerRoot(root: VirtualRoot): void;
export declare function unregisterRoot(root: VirtualRoot): void;
/**
 * Reconciles all active Remix UI roots.
 */
export declare function reconcileRoots(): void;
