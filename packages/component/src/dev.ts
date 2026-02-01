/**
 * Development-only APIs for component tooling integration.
 *
 * This module exports internal APIs used by development tools like HMR.
 * These APIs are not part of the mainline package exports and should only
 * be used by specialized tooling.
 *
 * @module @remix-run/component/dev
 */

import { setComponentStalenessCheck, reconcileAllRoots } from './lib/refresh.ts'

export { setComponentStalenessCheck }

/**
 * Trigger reconciliation on all registered roots.
 * This is called by HMR after marking components as stale.
 *
 * Roots are automatically registered when created and unregistered when removed.
 */
export function requestReconciliation(): void {
  reconcileAllRoots()
}
