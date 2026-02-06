// Implementation
export function hydrationRoot(href, component) {
    // Parse module URL and export name
    let [moduleUrl, exportName] = href.split('#');
    if (!moduleUrl) {
        throw new Error('hydrationRoot() requires a module URL');
    }
    // Use component name as fallback if no export name provided
    let finalExportName = exportName || component.name;
    if (!finalExportName) {
        throw new Error('hydrationRoot() requires either an export name in the href (e.g., "/js/module.js#ComponentName") or a named component function');
    }
    // Augment the component with hydration metadata
    component.$hydrated = true;
    component.$moduleUrl = moduleUrl;
    component.$exportName = finalExportName;
    return component;
}
/**
 * Type guard to check if a component is hydrated
 *
 * @param component The component to check
 * @returns True if the component has hydration metadata
 */
export function isHydratedComponent(component) {
    return Boolean(component && typeof component === 'function' && component.$hydrated === true);
}
//# sourceMappingURL=hydration-root.js.map