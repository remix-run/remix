const components = new Map();
export function registerComponentForHmr(moduleUrl, componentName, implementation) {
    components.set(getComponentKey(moduleUrl, componentName), implementation);
}
export function getCurrentComponentForHmr(moduleUrl, componentName) {
    let component = components.get(getComponentKey(moduleUrl, componentName));
    if (!component) {
        throw new Error(`[remix] Missing HMR component registration for ${moduleUrl}:${componentName}`);
    }
    return component;
}
function getComponentKey(moduleUrl, componentName) {
    return `${moduleUrl}:${componentName}`;
}
