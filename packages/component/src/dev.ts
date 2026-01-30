/**
 * Development-only APIs for component tooling integration.
 *
 * This module exports internal APIs used by development tools like HMR.
 * These APIs are not part of the mainline package exports and should only
 * be used by specialized tooling.
 *
 * @module @remix-run/component/dev
 */

import { setComponentStalenessCheck } from './lib/refresh.ts'
import type { VirtualRoot } from './lib/vdom.ts'

export { setComponentStalenessCheck }

// Root registry for HMR reconciliation
// Track roots in an array for iteration
let rootsArray: VirtualRoot[] = []

/**
 * Register a root for HMR reconciliation.
 * When components are marked stale, call `requestReconciliation()` to
 * trigger reconciliation on all registered roots.
 *
 * @param root The root to register
 * @returns Cleanup function to unregister the root
 */
export function registerRoot(root: VirtualRoot): () => void {
  rootsArray.push(root)
  return () => {
    let index = rootsArray.indexOf(root)
    if (index !== -1) {
      rootsArray.splice(index, 1)
    }
  }
}

/**
 * Trigger reconciliation on all registered roots.
 * This is called by HMR after marking components as stale.
 */
export function requestReconciliation(): void {
  rootsArray.forEach((root) => {
    root.reconcile()
  })
}
