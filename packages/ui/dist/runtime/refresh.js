export let componentStalenessCheck = null;
const roots = new Set();
/**
 * Installs the process-wide component compatibility check used during development refreshes.
 *
 * When the check returns `true`, reconciliation replaces existing instances of that component
 * instead of preserving their state. This is a low-level integration point for HMR runtimes.
 *
 * @param check Callback that returns `true` when instances of a component must be remounted.
 */
export function setComponentStalenessCheck(check) {
    componentStalenessCheck = check;
}
export function registerRoot(root) {
    roots.add(root);
}
export function unregisterRoot(root) {
    roots.delete(root);
}
/**
 * Immediately schedules reconciliation for every active Remix UI root using its current element.
 *
 * HMR runtimes call this after installing updated component implementations so mounted trees render
 * the new code while preserving compatible component state.
 */
export function reconcileRoots() {
    for (let root of roots) {
        root.reconcile();
    }
}
//# sourceMappingURL=refresh.js.map