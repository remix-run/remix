// Implementation
export function clientEntry(entryId, component) {
    if (!entryId) {
        throw new Error('clientEntry() requires an entry ID');
    }
    // Augment the component with entry metadata
    component.$entry = true;
    component.$entryId = entryId;
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