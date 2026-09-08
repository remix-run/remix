import type { VirtualRoot } from './vdom.ts'

/**
 * Reports whether an existing component instance must remount instead of reconciling during a
 * development refresh.
 *
 * @param type Component function being considered for reuse.
 * @returns `true` when existing instances must be remounted.
 */
export type ComponentStalenessCheck = (type: Function) => boolean

export let componentStalenessCheck: ComponentStalenessCheck | null = null

const roots = new Set<VirtualRoot>()

/**
 * Installs the process-wide component compatibility check used during development refreshes.
 *
 * When the check returns `true`, reconciliation replaces existing instances of that component
 * instead of preserving their state. This is a low-level integration point for HMR runtimes.
 *
 * @param check Callback that returns `true` when instances of a component must be remounted.
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
 * Immediately schedules reconciliation for every active Remix UI root using its current element.
 *
 * HMR runtimes call this after installing updated component implementations so mounted trees render
 * the new code while preserving compatible component state.
 */
export function reconcileRoots(): void {
  for (let root of roots) {
    root.reconcile()
  }
}
