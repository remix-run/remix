// Implementation
export function clientEntry(href, component) {
    // Parse module URL and export name
    let [moduleUrl, exportName] = href.split('#');
    if (!moduleUrl) {
        throw new Error('clientEntry() requires a module URL');
    }
    // Use component name as fallback if no export name provided
    let finalExportName = exportName || component.name;
    if (!finalExportName) {
        throw new Error('clientEntry() requires either an export name in the href (e.g., "/js/module.js#ComponentName") or a named component function');
    }
    // Augment the component with entry metadata
    component.$entry = true;
    component.$moduleUrl = moduleUrl;
    component.$exportName = finalExportName;
    return component;
}
/**
 * Type guard to check if a component is an entry component
 *
 * @param component The component to check
 * @returns True if the component has entry metadata
 */
export function isEntry(component) {
    return Boolean(component && typeof component === 'function' && component.$entry === true);
}
/**
 * Logs a client-hydration mismatch to the console.
 *
 * @param msg Message parts to forward to the logger.
 */
export function logHydrationMismatch(...msg) {
    console.error('Hydration mismatch:', ...msg);
}
/**
 * Advances a DOM cursor past consecutive comment nodes.
 *
 * @param cursor Starting DOM node.
 * @returns The first non-comment node, or `null` when none remains.
 */
export function skipComments(cursor) {
    while (cursor && cursor.nodeType === Node.COMMENT_NODE) {
        cursor = cursor.nextSibling;
    }
    return cursor;
}
//# sourceMappingURL=client-entries.js.map