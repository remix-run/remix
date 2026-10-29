const components = new Map();
const componentKeys = new WeakMap();
const componentState = new WeakMap();
const componentSetupHashes = new WeakMap();
const renderFunctions = new WeakMap();
const staleComponentKeys = new Set();
let isStalenessCheckInstalled = false;
export function registerComponentForHmr(refresh, moduleUrl, componentName, implementation, setupHash, wrapper) {
    installStalenessCheck(refresh);
    let key = getComponentKey(moduleUrl, componentName);
    let existing = components.get(key);
    if (existing && existing.setupHash !== setupHash) {
        staleComponentKeys.add(key);
    }
    components.set(key, {
        handles: existing?.handles ?? new Set(),
        implementation,
        setupHash,
    });
    componentKeys.set(wrapper, key);
}
export function getCurrentComponentForHmr(moduleUrl, componentName) {
    let key = getComponentKey(moduleUrl, componentName);
    let component = components.get(key);
    if (!component) {
        throw new Error(`[remix] Missing HMR component registration for ${key}`);
    }
    return component.implementation;
}
export function getComponentHandleForHmr(handle, moduleUrl, componentName) {
    if (isComponentHmrHandle(handle))
        return handle;
    throw new Error(`[remix] Expected HMR component handle for ${getComponentKey(moduleUrl, componentName)}`);
}
export function getComponentHmrState(handle) {
    let state = componentState.get(handle);
    if (state === undefined) {
        state = Object.create(null);
        componentState.set(handle, state);
    }
    return state;
}
export function setupComponentForHmr(handle, state, moduleUrl, componentName, setupHash, setup, wrapper) {
    let key = getComponentKey(moduleUrl, componentName);
    componentKeys.set(wrapper, key);
    let setupHashes = componentSetupHashes.get(handle);
    if (!setupHashes) {
        setupHashes = new Map();
        componentSetupHashes.set(handle, setupHashes);
    }
    let currentSetupHash = setupHashes.get(key);
    if (currentSetupHash === undefined) {
        setup(state);
        setupHashes.set(key, setupHash);
        return false;
    }
    if (currentSetupHash === setupHash) {
        return false;
    }
    if (Object.keys(state).length === 0) {
        setup(state);
        setupHashes.set(key, setupHash);
        return false;
    }
    clearComponentHmrState(handle);
    setupHashes.delete(key);
    staleComponentKeys.add(key);
    return true;
}
export function clearComponentHmrState(handle) {
    componentState.delete(handle);
    renderFunctions.delete(handle);
}
export function registerComponentRenderForHmr(refresh, moduleUrl, componentName, handle, render, wrapper) {
    let key = getComponentKey(moduleUrl, componentName);
    installStalenessCheck(refresh);
    componentKeys.set(wrapper, key);
    renderFunctions.set(handle, render);
    let component = components.get(key);
    let wasTracked = component?.handles.has(handle) === true;
    if (component) {
        component.handles.add(handle);
    }
    if (wasTracked)
        return;
    handle.signal.addEventListener('abort', () => {
        components.get(key)?.handles.delete(handle);
        clearComponentHmrState(handle);
    }, { once: true });
}
export function callComponentRenderForHmr(handle, ...args) {
    let render = renderFunctions.get(handle);
    if (!render) {
        throw new Error('[remix] Missing HMR component render function');
    }
    return render(...args);
}
export function registerComponentInstanceForHmr(handle, cleanup = () => clearComponentHmrState(handle)) {
    handle.signal.addEventListener('abort', cleanup, { once: true });
}
export function updateComponentModuleForHmr(refresh, moduleUrl, module) {
    let modulePrefix = `${moduleUrl}:`;
    let updated = false;
    for (let key of components.keys()) {
        if (!key.startsWith(modulePrefix))
            continue;
        let componentName = key.slice(modulePrefix.length);
        if (componentName in module) {
            updated = true;
            let component = components.get(key);
            let updatedComponent = module[componentName];
            if (typeof updatedComponent === 'function') {
                for (let handle of component?.handles ?? []) {
                    updatedComponent(handle);
                }
            }
        }
        else {
            staleComponentKeys.add(key);
        }
    }
    if (!updated) {
        staleComponentKeys.add(modulePrefix);
    }
    refresh.reconcileRoots();
    queueMicrotask(() => {
        staleComponentKeys.clear();
    });
}
function installStalenessCheck(refresh) {
    if (isStalenessCheckInstalled)
        return;
    isStalenessCheckInstalled = true;
    refresh.setComponentStalenessCheck((component) => {
        let key = componentKeys.get(component);
        return key !== undefined && staleComponentKeys.has(key);
    });
}
function getComponentKey(moduleUrl, componentName) {
    return `${moduleUrl}:${componentName}`;
}
function isComponentHmrHandle(value) {
    return (typeof value === 'object' &&
        value !== null &&
        'signal' in value &&
        value.signal instanceof AbortSignal);
}
