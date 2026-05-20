import { TypedEventTarget } from "./typed-event-target.js";
/**
 * Creates the internal runtime wrapper for a component instance.
 *
 * @param config Component runtime configuration.
 * @returns Component runtime helpers used by the reconciler.
 */
export function createComponent(config) {
    return new ComponentRuntime(config);
}
class ComponentRuntime {
    frame;
    #config;
    #connectedController;
    #contextValue;
    #handle;
    #props = {};
    #renderController;
    #renderFn;
    #removed = false;
    #scheduleUpdate = () => {
        throw new Error('scheduleUpdate not implemented');
    };
    #tasks = [];
    constructor(config) {
        this.#config = config;
        this.frame = config.frame;
        this.#handle = this.#createHandle();
    }
    render = (nextProps) => {
        if (this.#removed) {
            console.warn('render called after component was removed, potential application memory leak');
            return [null, []];
        }
        this.#abortRenderSignal();
        syncProps(this.#props, nextProps);
        let renderFn = this.#renderFn;
        if (renderFn === undefined) {
            let result = this.#config.type(this.#handle);
            if (typeof result !== 'function') {
                let name = this.#config.type.name || 'Anonymous';
                throw new Error(`${name} must return a render function, received ${typeof result}`);
            }
            renderFn = result;
            this.#renderFn = renderFn;
        }
        return [renderFn(this.#props), this.#dequeueTasks()];
    };
    remove = () => {
        if (this.#removed)
            return [];
        this.#removed = true;
        this.#connectedController?.abort();
        this.#abortRenderSignal();
        return this.#dequeueTasks(AbortSignal.abort());
    };
    setScheduleUpdate = (nextScheduleUpdate) => {
        this.#scheduleUpdate = nextScheduleUpdate;
    };
    getContextValue = () => this.#contextValue;
    isRemoved = () => this.#removed;
    #createHandle() {
        let component = this;
        let context = {
            set: (value) => {
                this.#contextValue = value;
            },
            get: (type) => this.#config.getContext(type),
        };
        return {
            id: this.#config.id,
            props: this.#props,
            update: () => new Promise((resolve) => {
                if (component.#removed) {
                    resolve(AbortSignal.abort());
                    return;
                }
                this.#tasks.push((signal) => resolve(signal));
                this.#scheduleUpdate();
            }),
            queueTask: (task) => {
                this.#tasks.push(task);
            },
            frame: this.#config.frame,
            frames: {
                get top() {
                    return component.#config.getTopFrame?.() ?? component.#config.frame;
                },
                get(name) {
                    return component.#config.getFrameByName(name);
                },
            },
            context,
            get signal() {
                return component.#config.signal ?? component.#connectedSignal();
            },
        };
    }
    #connectedSignal() {
        this.#connectedController ??= new AbortController();
        return this.#connectedController.signal;
    }
    #abortRenderSignal() {
        this.#renderController?.abort();
        this.#renderController = undefined;
    }
    #dequeueTasks(signal) {
        let needsSignal = signal === undefined && this.#tasks.some((task) => task.length >= 1);
        if (needsSignal) {
            this.#renderController ??= new AbortController();
        }
        signal ??= this.#renderController?.signal;
        let tasks = this.#tasks.splice(0, this.#tasks.length);
        return tasks.map((task) => () => task(signal));
    }
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