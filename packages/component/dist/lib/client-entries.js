// Implementation
export function clientEntry(asset, component) {
    if (typeof asset !== 'object' || asset === null) {
        // Parse module URL and export name
        let [moduleUrl, parsedExportName] = asset?.split('#') ?? [];
        if (!moduleUrl) {
            throw new Error('clientEntry() requires a module URL');
        }
        // Use component name as fallback if no export name provided
        let finalExportName = parsedExportName || component.name;
        if (!finalExportName) {
            throw new Error('clientEntry() requires either an exportName in the asset, a hash in a string (e.g., "/js/module.js#ComponentName") or a named component function');
        }
        asset = {
            exportName: finalExportName,
            js: [{ src: moduleUrl }],
        };
    }
    if (!asset) {
        throw new Error('clientEntry() requires an asset');
    }
    // Augment the component with entry metadata
    component.$entry = true;
    component.$asset = asset;
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
export function logHydrationMismatch(...msg) {
    console.error('Hydration mismatch:', ...msg);
}
export function skipComments(cursor) {
    while (cursor && cursor.nodeType === Node.COMMENT_NODE) {
        cursor = cursor.nextSibling;
    }
    return cursor;
}
//# sourceMappingURL=client-entries.js.map