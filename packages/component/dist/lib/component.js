import { createContainer } from '@remix-run/interaction';
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
    let context = {
        set: (value) => {
            contextValue = value;
        },
        get: (type) => {
            return config.getContext(type);
        },
    };
    let handle = {
        id: config.id,
        update: (task) => {
            if (task)
                taskQueue.push(task);
            scheduleUpdate();
        },
        queueTask: (task) => {
            taskQueue.push(task);
        },
        frame: config.frame,
        context: context,
        get signal() {
            return getConnectedSignal();
        },
        on: (target, listeners) => {
            let container = createContainer(target, { signal: getConnectedSignal() });
            container.set(listeners);
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
        if (!getContent) {
            // Extract setup prop (passed to component setup function, not render)
            let { setup, ...propsWithoutSetup } = props;
            let result = config.type(handle, setup);
            if (typeof result !== 'function') {
                let name = config.type.name || 'Anonymous';
                throw new Error(`${name} must return a render function, received ${typeof result}`);
            }
            else {
                getContent = (props) => {
                    // Strip setup from props since it's only for setup
                    let { setup: _, ...rest } = props;
                    return result(rest);
                };
            }
        }
        let node = getContent(props);
        return [node, dequeueTasks()];
    }
    function remove() {
        if (connectedCtrl)
            connectedCtrl.abort();
        return dequeueTasks();
    }
    function setScheduleUpdate(_scheduleUpdate) {
        scheduleUpdate = _scheduleUpdate;
    }
    function getContextValue() {
        return contextValue;
    }
    return { render, remove, setScheduleUpdate, frame: config.frame, getContextValue };
}
export function Frame(handle) {
    return (_) => null; // reconciler renders
}
export function Fragment() {
    return (_) => null; // reconciler renders
}
export function createFrameHandle(def) {
    return Object.assign(new EventTarget(), {
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