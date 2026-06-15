export let componentStalenessCheck = null;
const roots = new Set();
export function setComponentStalenessCheck(check) {
    componentStalenessCheck = check;
}
export function registerRoot(root) {
    roots.add(root);
}
export function unregisterRoot(root) {
    roots.delete(root);
}
export function reconcileAllRoots() {
    for (let root of roots) {
        root.reconcile();
    }
}
//# sourceMappingURL=refresh.js.map