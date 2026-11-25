import { roots } from '../runtime/vdom.ts'
export { setComponentStalenessCheck } from '../runtime/vdom.ts'

/**
 * Immediately schedules reconciliation for every active component root using its current element.
 *
 * HMR runtimes call this after installing updated component implementations so mounted trees render
 * the new code while preserving compatible component state.
 */
export function reconcileRoots(): void {
  for (let root of roots) {
    root.reconcile()
  }
}
