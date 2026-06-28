export let componentStalenessCheck = null;
const roots = new Set();
/**
 * Installs the component staleness check used by HMR runtimes.
 *
 * @param check Callback that reports whether a component is stale.
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
 * Reconciles all active Remix UI roots.
 */
export function reconcileRoots() {
    for (let root of roots) {
        root.reconcile();
    }
}
//# sourceMappingURL=refresh.js.map