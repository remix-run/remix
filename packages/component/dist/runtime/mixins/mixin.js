import { jsx } from '../jsx.js';
import { TypedEventTarget } from '../typed-event-target.js';
import { invariant } from '../invariant.js';
import { composeMixedProps, isMixinElementFunction } from '../core/mix.js';
export function renderMixinElement(element, props) {
    let { key, ...rest } = (props ?? {});
    return jsx(element, rest, key);
}
let mixinHandleId = 0;
/**
 * Creates a typed mixin factory that can be passed through the `mix` prop.
 *
 * @param type Mixin setup function.
 * @param options Server rendering options.
 * @returns A function that captures mixin arguments and returns a descriptor.
 */
export function createMixin(type, options = {}) {
    // Keep browser-only metadata local to this factory when setup is shared.
    let mixinType = options.ssr === false || '__rmxMixinSsr' in type
        ? Object.assign(function mixinSetup(handle, hostType) {
            return type(handle, hostType);
        }, { __rmxMixinSsr: options.ssr !== false })
        : type;
    return (...args) => ({
        type: mixinType,
        args: args,
    });
}
export function resolveMixedProps(input) {
    let state = input.state ?? createMixinRuntimeState();
    let hostType = input.hostType;
    state.handle ??= new MixinHandleImpl(state, hostType, input.frame, input.scheduler, input.getContext ?? (() => undefined));
    let handle = state.handle;
    let runnerCount = 0;
    let props = composeMixedProps(hostType, input.props, (descriptor, index, mixinProps) => {
        runnerCount = index + 1;
        let entry = state.runners[index];
        if (!entry || entry.type !== descriptor.type) {
            if (entry) {
                queueMixinRemove(handle, entry.scope);
            }
            let scope = Symbol('mixin-scope');
            handle.setActiveScope(scope);
            entry = {
                scope,
                type: descriptor.type,
                runner: normalizeMixinRunner(descriptor.type(handle, hostType), handle),
            };
            handle.setActiveScope(undefined);
            state.runners[index] = entry;
            let binding = state.binding;
            if (binding?.node) {
                queueMixinBindEvent(handle, entry.scope, 'insert', binding);
            }
        }
        // Unlike the server renderer, mixin errors are not isolated here: a
        // throwing mixin aborts the client render.
        handle.setActiveScope(entry.scope);
        let result = entry.runner(...descriptor.args, mixinProps);
        handle.setActiveScope(undefined);
        return result;
    });
    for (let index = runnerCount; index < state.runners.length; index++) {
        let entry = state.runners[index];
        if (entry) {
            removeMixinScope(handle, entry.scope);
        }
    }
    if (state.runners.length > runnerCount) {
        state.runners.length = runnerCount;
    }
    return { state, props };
}
export function teardownMixins(state) {
    if (!state)
        return;
    state.binding = undefined;
    prepareMixinRemoval(state);
    cancelPendingMixinRemoval(state);
    let handle = state.handle;
    if (handle) {
        handle.queueCommitTask(() => finalizeMixinTeardown(state));
        return;
    }
    finalizeMixinTeardown(state);
}
export function bindMixinRuntime(state, binding, reclaimed) {
    if (!state)
        return;
    let previousNode = state.binding?.node;
    state.binding = binding;
    if (!binding?.node || previousNode === binding.node)
        return;
    let handle = state.handle;
    if (!handle)
        return;
    for (let entry of state.runners) {
        queueMixinBindEvent(handle, entry.scope, reclaimed ? 'reclaimed' : 'insert', binding);
    }
}
export function prepareMixinRemoval(state) {
    if (!state || state.removePrepared)
        return state?.pendingRemoval?.done;
    state.removePrepared = true;
    let pendingRemoval;
    let persistTeardowns = [];
    let registerPersistNode = (teardown) => {
        persistTeardowns.push(teardown);
    };
    if (!state.handle)
        return;
    dispatchMixinEvent(state, () => {
        let event = new Event('beforeRemove');
        event.persistNode = registerPersistNode;
        return event;
    });
    if (persistTeardowns.length > 0) {
        let controller = new AbortController();
        let done = Promise.allSettled(persistTeardowns.map((teardown) => Promise.resolve().then(() => teardown(controller.signal)))).then(() => { });
        pendingRemoval = { controller, done };
    }
    state.pendingRemoval = pendingRemoval;
    return pendingRemoval?.done;
}
export function cancelPendingMixinRemoval(state, reason = new DOMException('', 'AbortError')) {
    if (!state?.pendingRemoval)
        return;
    state.pendingRemoval.controller.abort(reason);
    state.pendingRemoval = undefined;
    state.removePrepared = false;
}
function createMixinRuntimeState() {
    return {
        id: `m${++mixinHandleId}`,
        aborted: false,
        runners: [],
    };
}
class MixinHandleImpl extends TypedEventTarget {
    id;
    context;
    frame;
    element;
    #state;
    #scheduler;
    #phaseListenerCounts = {
        beforeUpdate: 0,
        commit: 0,
    };
    #activeScope;
    #scopes = new Map();
    #onSchedulerPhase = (event) => {
        let binding = this.#state.binding;
        if (!binding)
            return;
        if (!isBindingInUpdateScope(binding, event.parents))
            return;
        for (let [, scope] of this.#scopes) {
            let updateEvent = new Event(event.type);
            updateEvent.node = binding.node;
            scope.target.dispatchEvent(updateEvent);
        }
    };
    constructor(state, hostType, frame, scheduler, getContext) {
        super();
        this.#state = state;
        this.#scheduler = scheduler;
        this.id = state.id;
        this.context = {
            get: getContext,
        };
        this.frame = frame;
        let element = ((_, __) => (props) => ({
            $rmx: true,
            type: hostType,
            key: null,
            props,
        }));
        element.__rmxMixinElementType = hostType;
        this.element = element;
    }
    get signal() {
        let scope = this.#activeScope;
        invariant(scope, 'handle.signal is only available during mixin setup, render, or lifecycle callbacks');
        let record = this.#scopes.get(scope);
        invariant(record);
        record.controller ??= new AbortController();
        return record.controller.signal;
    }
    addEventListener(type, listener, options) {
        let scope = this.#getActiveScope();
        scope.target.addEventListener(type, listener, options);
        if (!listener || !isSchedulerPhaseType(type))
            return;
        scope.phaseCounts[type] += 1;
        this.#updatePhaseListenerCount(type, 1);
    }
    removeEventListener(type, listener, options) {
        let scope = this.#getActiveScope();
        scope.target.removeEventListener(type, listener, typeof options === 'boolean' ? { capture: options } : options);
        if (!listener || !isSchedulerPhaseType(type))
            return;
        scope.phaseCounts[type] = Math.max(0, scope.phaseCounts[type] - 1);
        this.#updatePhaseListenerCount(type, -1);
    }
    update() {
        return new Promise((resolve) => {
            let signal = getMixinRuntimeSignal(this.#state);
            if (signal.aborted) {
                resolve(signal);
                return;
            }
            let binding = this.#state.binding;
            if (!binding) {
                resolve(signal);
                return;
            }
            binding.enqueueUpdate(resolve);
        });
    }
    queueTask(task) {
        this.#scheduler.enqueueTasks([
            () => {
                let binding = this.#state.binding;
                invariant(binding);
                task(binding.node, getMixinRuntimeSignal(this.#state));
            },
        ]);
    }
    queueCommitTask(task) {
        this.#scheduler.enqueueCommitPhase([task]);
    }
    setActiveScope(scope) {
        this.#activeScope = scope;
        if (!scope)
            return;
        if (this.#scopes.has(scope))
            return;
        this.#scopes.set(scope, {
            target: new TypedEventTarget(),
            phaseCounts: { beforeUpdate: 0, commit: 0 },
        });
    }
    dispatchScopedEvent(scope, event) {
        let record = this.#scopes.get(scope);
        if (!record)
            return;
        let previousScope = this.#activeScope;
        this.#activeScope = scope;
        record.target.dispatchEvent(event);
        this.#activeScope = previousScope;
    }
    releaseScope(scope) {
        let record = this.#scopes.get(scope);
        if (record) {
            this.#updatePhaseListenerCount('beforeUpdate', -record.phaseCounts.beforeUpdate);
            this.#updatePhaseListenerCount('commit', -record.phaseCounts.commit);
            record.controller?.abort();
            this.#scopes.delete(scope);
        }
        if (this.#activeScope === scope) {
            this.#activeScope = undefined;
        }
    }
    #getActiveScope() {
        let scope = this.#activeScope;
        invariant(scope);
        let record = this.#scopes.get(scope);
        invariant(record);
        return record;
    }
    // Subscribes to the scheduler phase when the first listener is added and
    // unsubscribes whenever the count reaches zero on removal.
    #updatePhaseListenerCount(type, delta) {
        if (delta === 0)
            return;
        let count = Math.max(0, this.#phaseListenerCounts[type] + delta);
        this.#phaseListenerCounts[type] = count;
        if (delta > 0) {
            if (count === 1)
                this.#scheduler.addEventListener(type, this.#onSchedulerPhase);
        }
        else if (count === 0) {
            this.#scheduler.removeEventListener(type, this.#onSchedulerPhase);
        }
    }
}
export function getMixinRuntimeSignal(state) {
    let controller = state.controller;
    if (!controller) {
        controller = new AbortController();
        if (state.aborted) {
            controller.abort();
        }
        state.controller = controller;
    }
    return controller.signal;
}
export function dispatchMixinBeforeUpdate(state) {
    dispatchMixinUpdateEvent(state, 'beforeUpdate');
}
export function dispatchMixinCommit(state) {
    dispatchMixinUpdateEvent(state, 'commit');
}
function queueMixinBindEvent(handle, scope, type, binding) {
    let { node, parent, key } = binding;
    handle.queueCommitTask(() => {
        let event = new Event(type);
        event.node = node;
        event.parent = parent;
        event.key = key;
        handle.dispatchScopedEvent(scope, event);
    });
}
function removeMixinScope(handle, scope) {
    handle.dispatchScopedEvent(scope, new Event('remove'));
    handle.releaseScope(scope);
}
function queueMixinRemove(handle, scope) {
    handle.queueCommitTask(() => removeMixinScope(handle, scope));
}
function dispatchMixinEvent(state, createEvent) {
    if (!state?.handle)
        return;
    let handle = state.handle;
    for (let entry of state.runners) {
        handle.dispatchScopedEvent(entry.scope, createEvent());
    }
}
function finalizeMixinTeardown(state) {
    dispatchMixinEvent(state, () => new Event('remove'));
    let handle = state.handle;
    if (handle) {
        for (let entry of state.runners) {
            handle.releaseScope(entry.scope);
        }
    }
    state.runners.length = 0;
    state.aborted = true;
    state.controller?.abort();
    state.pendingRemoval = undefined;
    state.removePrepared = true;
    state.handle = undefined;
}
function dispatchMixinUpdateEvent(state, type) {
    let node = state?.binding?.node;
    if (!node)
        return;
    dispatchMixinEvent(state, () => {
        let event = new Event(type);
        event.node = node;
        return event;
    });
}
function isSchedulerPhaseType(type) {
    return type === 'beforeUpdate' || type === 'commit';
}
function isBindingInUpdateScope(binding, parents) {
    for (let parent of parents) {
        if (parent.contains(binding.node))
            return true;
    }
    return false;
}
function normalizeMixinRunner(result, handle) {
    if (typeof result === 'function' && !isMixinElementFunction(result)) {
        return result;
    }
    if (result === undefined) {
        return () => handle.element;
    }
    return () => result;
}
//# sourceMappingURL=mixin.js.map