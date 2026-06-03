/**
 * Built-in component used to group children without adding a host element.
 *
 * @param handle Component handle for the fragment instance.
 * @returns A placeholder render function handled by the reconciler.
 */
export function Fragment(handle) {
    void handle;
    return () => null; // reconciler renders
}
//# sourceMappingURL=fragment.js.map