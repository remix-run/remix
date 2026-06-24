import type { VirtualRoot } from './vdom.ts'

/**
 * Checks whether a component should be treated as stale during HMR reconciliation.
 */
export type ComponentStalenessCheck = (type: Function) => boolean

export let componentStalenessCheck: ComponentStalenessCheck | null = null

const roots = new Set<VirtualRoot>()

/**
 * Installs the component staleness check used by HMR runtimes.
 *
 * @param check Callback that reports whether a component is stale.
 */
export function setComponentStalenessCheck(check: ComponentStalenessCheck): void {
  componentStalenessCheck = check
}

export function registerRoot(root: VirtualRoot): void {
  roots.add(root)
}

export function unregisterRoot(root: VirtualRoot): void {
  roots.delete(root)
}

/**
 * Reconciles all active Remix UI roots.
 */
export function reconcileRoots(): void {
  for (let root of roots) {
    root.reconcile()
  }
}
