import { TypedEventTarget } from "./typed-event-target.js";
/**
 * Creates the internal runtime wrapper for a component instance.
 *
 * @param config Component runtime configuration.
 * @returns Component runtime helpers used by the reconciler.
 */
export function createComponent(config) {
    let taskQueue = [];
    let renderCtrl = null;
    let connectedCtrl = null;
    let contextValue = undefined;
    function getConnectedSignal() {
        if (!connectedCtrl)
            connectedCtrl = new AbortController();
        return connectedCtrl.signal;
    }
    let getContent = null;
    let scheduleUpdate = () => {
        throw new Error('scheduleUpdate not implemented');
    };
    let props = {};
    let context = {
        set: (value) => {
            contextValue = value;
        },
        get: (type) => config.getContext(type),
    };
    let handle = {
        id: config.id,
        props,
        update: () => new Promise((resolve) => {
            taskQueue.push((signal) => resolve(signal));
            scheduleUpdate();
        }),
        queueTask: (task) => {
            taskQueue.push(task);
        },
        frame: config.frame,
        frames: {
            get top() {
                return config.getTopFrame?.() ?? config.frame;
            },
            get(name) {
                return config.getFrameByName(name);
            },
        },
        context: context,
        get signal() {
            return config.signal ?? getConnectedSignal();
        },
    };
    function dequeueTasks() {
        // Only create render controller if any task expects a signal (has length >= 1)
        let needsSignal = taskQueue.some((task) => task.length >= 1);
        if (needsSignal && !renderCtrl) {
            renderCtrl = new AbortController();
        }
        let signal = renderCtrl?.signal;
        return taskQueue.splice(0, taskQueue.length).map((task) => () => task(signal));
    }
    function render(props) {
        if (connectedCtrl?.signal.aborted) {
            console.warn('render called after component was removed, potential application memory leak');
            return [null, []];
        }
        // Only abort render controller if it was initialized
        if (renderCtrl) {
            renderCtrl.abort();
            renderCtrl = null;
        }
        syncProps(handle.props, props);
        let renderContent = getContent;
        if (!renderContent) {
            let result = config.type(handle);
            if (typeof result !== 'function') {
                let name = config.type.name || 'Anonymous';
                throw new Error(`${name} must return a render function, received ${typeof result}`);
            }
            else {
                getContent = result;
                renderContent = result;
            }
        }
        if (!renderContent) {
            throw new Error('component render function was not initialized');
        }
        let node = renderContent(handle.props);
        return [node, dequeueTasks()];
    }
    function remove() {
        connectedCtrl?.abort();
        renderCtrl?.abort();
        return dequeueTasks();
    }
    function setScheduleUpdate(nextScheduleUpdate) {
        scheduleUpdate = nextScheduleUpdate;
    }
    function getContextValue() {
        return contextValue;
    }
    return { render, remove, setScheduleUpdate, frame: config.frame, getContextValue };
}
function syncProps(target, next) {
    for (let key in target) {
        if (!(key in next)) {
            delete target[key];
        }
    }
    for (let key in next) {
        target[key] = next[key];
    }
}
/**
 * Built-in component used to render nested frame content.
 *
 * @param handle Component handle for the frame instance.
 * @returns A placeholder render function handled by the reconciler.
 */
export function Frame(handle) {
    void handle;
    return () => null; // reconciler renders
}
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
/**
 * Creates a frame handle with default no-op implementations for testing and internal wiring.
 *
 * @param def Partial frame-handle implementation to merge with the defaults.
 * @returns A frame handle object.
 */
export function createFrameHandle(def) {
    return Object.assign(new TypedEventTarget(), {
        src: '/',
        replace: notImplemented('replace not implemented'),
        reload: notImplemented('reload not implemented'),
    }, def);
}
function notImplemented(msg) {
    return () => {
        throw new Error(msg);
    };
}
//# sourceMappingURL=component.js.map