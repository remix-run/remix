/**
 * Component refresh infrastructure for HMR integration.
 *
 * This module provides a minimal hook point for external tools (like HMR) to
 * mark components as "stale" and trigger full remounts during reconciliation.
 *
 * The reconciler doesn't know about HMR - it just provides this extension point.
 * HMR registers a staleness checker and the reconciler calls it during diffing.
 */

export type ComponentStalenessCheck = (type: Function) => boolean

let stalenessCheck: ComponentStalenessCheck | null = null

/**
 * Internal setter for registering a staleness check function.
 * Used by dev.ts to expose the public API.
 *
 * @internal
 */
export function setComponentStalenessCheck(check: ComponentStalenessCheck) {
  stalenessCheck = check
}

/**
 * Internal checker called by the reconciler during component diffing.
 * Returns true if the component type is marked as stale and should be remounted.
 *
 * This is a consuming check - it returns the staleness state and the HMR runtime
 * is responsible for clearing it after the check. This ensures that when the
 * reconciler creates a new handle and calls the component again, staleness is cleared.
 *
 * @internal
 */
export function checkComponentStaleness(type: Function): boolean {
  return stalenessCheck?.(type) ?? false
}
