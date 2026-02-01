/**
 * Component refresh infrastructure for HMR integration.
 *
 * This module provides minimal hook points for external tools (like HMR) to:
 * 1. Mark components as "stale" and trigger full remounts during reconciliation
 * 2. Request reconciliation of all roots when components change
 *
 * The reconciler doesn't know about HMR - it just provides extension points.
 * HMR registers a staleness checker and the reconciler calls it during diffing.
 */

import type { VirtualRoot } from './vdom.ts'

export type ComponentStalenessCheck = (type: Function) => boolean

// Performance optimization: export the staleness check directly so hot code paths
// can check if it exists without an extra function call wrapper
// Null when no check is registered (production), function when HMR is active
export let componentStalenessCheck: ComponentStalenessCheck | null = null

// Private root registry - dev tools never access this directly
let roots: VirtualRoot[] = []

/**
 * Register a staleness check function for HMR remounting.
 * Re-exported from dev.ts as public API for HMR tooling.
 *
 * @param check Function that checks if a component type is stale
 */
export function setComponentStalenessCheck(check: ComponentStalenessCheck) {
  componentStalenessCheck = check
}

/**
 * Internal function to register a root.
 * Called automatically when roots are created.
 *
 * @param root The root to register
 * @internal
 */
export function registerRoot(root: VirtualRoot): void {
  roots.push(root)
}

/**
 * Internal function to unregister a root.
 * Called automatically when roots are removed.
 *
 * @param root The root to unregister
 * @internal
 */
export function unregisterRoot(root: VirtualRoot): void {
  let index = roots.indexOf(root)
  if (index !== -1) {
    roots.splice(index, 1)
  }
}

/**
 * Internal function to reconcile all registered roots.
 * Used by dev.ts to expose the public API for HMR.
 *
 * @internal
 */
export function reconcileAllRoots(): void {
  roots.forEach((root) => {
    root.reconcile()
  })
}
