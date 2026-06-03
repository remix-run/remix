import { TypedEventTarget } from "../typed-event-target.js";
import { invariant } from "../invariant.js";
export { createMixin, renderMixinElement } from "./mixin-descriptor.js";
let mixinHandleId = 0;
export function resolveMixedProps(input) {
    let state = input.state ??
        {
            id: `m${++mixinHandleId}`,
            aborted: false,
            runners: [],
        };
    let handle = state.handle;
    if (!handle) {
        handle = new MixinHandleImpl({
            id: state.id,
            hostType: input.hostType,
            frame: input.frame,
            scheduler: input.scheduler,
            getContext: input.getContext ?? (() => undefined),
            getRuntimeSignal: () => getMixinRuntimeSignal(state),
            getBinding: () => state.binding,
        });
        state.handle = handle;
    }
    let hostType = input.hostType;
    let descriptors = resolveMixDescriptors(input.props);
    let composedProps = withoutMix(input.props);
    let mixinProps = withoutMixinTreeProps(composedProps);
    let maxDescriptors = 1024;
    for (let index = 0; index < descriptors.length && index < maxDescriptors; index++) {
        let descriptor = descriptors[index];
        let entry = state.runners[index];
        if (!entry || entry.type !== descriptor.type) {
            if (entry) {
                queueMixinRemove(handle, entry.scope);
            }
            let scope = Symbol();
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
                queueMixinNodeEvent(handle, entry.scope, 'insert', binding.node, binding.parent, binding.key);
            }
        }
        handle.setActiveScope(entry.scope);
        let result = entry.runner(...descriptor.args, mixinProps);
        handle.setActiveScope(undefined);
        if (!result)
            continue;
        if (isMixinElement(result))
            continue;
        let returnedDescriptors = resolveReturnedMixDescriptors(result);
        if (returnedDescriptors) {
            for (let returned of returnedDescriptors)
                descriptors.push(returned);
            continue;
        }
        if (!isRemixElement(result)) {
            console.error(new Error('mixins must return a remix element'));
            continue;
        }
        let resultType = typeof result.type === 'string'
            ? result.type
            : isMixinElement(result.type)
                ? result.type.__rmxMixinElementType
                : null;
        if (resultType !== hostType) {
            console.error(new Error('mixins must return an element with the same host type'));
            continue;
        }
        if (result.type !== resultType) {
            result = { ...result, type: resultType };
        }
        let nextProps = sanitizeReturnedMixinProps(result.props);
        let nestedDescriptors = resolveMixDescriptors(nextProps);
        for (let nested of nestedDescriptors)
            descriptors.push(nested);
        composedProps = { ...composedProps, ...withoutMix(nextProps) };
        mixinProps = withoutMixinTreeProps(composedProps);
    }
    for (let index = descriptors.length; index < state.runners.length; index++) {
        let entry = state.runners[index];
        handle.dispatchScopedEvent(entry.scope, new Event('remove'));
        handle.releaseScope(entry.scope);
    }
    if (state.runners.length > descriptors.length) {
        state.runners.length = descriptors.length;
    }
    let nextMix = input.props.mix;
    return {
        state,
        props: {
            ...composedProps,
            ...(nextMix === undefined ? {} : { mix: nextMix }),
        },
    };
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
export function bindMixinRuntime(state, binding, options) {
    if (!state)
        return;
    let previousNode = state.binding?.node;
    let nextBinding = binding;
    state.binding = nextBinding;
    if (!nextBinding?.node || previousNode === nextBinding.node)
        return;
    let nextNode = nextBinding.node;
    let handle = state.handle;
    if (!handle)
        return;
    let eventType = options?.dispatchReclaimed ? 'reclaimed' : 'insert';
    for (let entry of state.runners) {
        queueMixinNodeEvent(handle, entry.scope, eventType, nextNode, nextBinding.parent, nextBinding.key);
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
    let handle = state.handle;
    if (!handle)
        return;
    for (let entry of state.runners) {
        dispatchMixinBeforeRemove(handle, entry.scope, registerPersistNode);
    }
    if (persistTeardowns.length > 0) {
        let controller = new AbortController();
        let done = Promise.allSettled(persistTeardowns.map((teardown) => Promise.resolve().then(() => teardown(controller.signal)))).then(() => { });
        pendingRemoval = {
            signal: controller.signal,
            cancel(reason) {
                controller.abort(reason);
            },
            done,
        };
    }
    state.pendingRemoval = pendingRemoval;
    return pendingRemoval?.done;
}
export function cancelPendingMixinRemoval(state, reason = new DOMException('', 'AbortError')) {
    if (!state?.pendingRemoval)
        return;
    state.pendingRemoval.cancel(reason);
    state.pendingRemoval = undefined;
    state.removePrepared = false;
}
class MixinHandleImpl extends TypedEventTarget {
    id;
    context;
    frame;
    element;
    #init;
    #phases = {
        beforeUpdate: 0,
        commit: 0,
    };
    #scope;
    #signals = new Map();
    #targets = new Map();
    #scopePhases = new Map();
    #onBeforeUpdate = (event) => {
        this.#dispatchPhase('beforeUpdate', event);
    };
    #onCommit = (event) => {
        this.#dispatchPhase('commit', event);
    };
    constructor(options) {
        super();
        this.#init = options;
        this.id = options.id;
        this.context = {
            get: options.getContext,
        };
        this.frame = options.frame;
        let element = ((_, __) => (props) => ({
            $rmx: true,
            type: options.hostType,
            key: null,
            props,
        }));
        element.__rmxMixinElementType = options.hostType;
        this.element = element;
    }
    get signal() {
        let scope = this.#scope;
        invariant(scope, 'handle.signal is only available during mixin setup, render, or lifecycle callbacks');
        return this.#scopeSignal(scope);
    }
    addEventListener(type, listener, options) {
        let target = this.#activeTarget();
        target.addEventListener(type, listener, options);
        if (!listener || !isSchedulerPhaseType(type))
            return;
        let scope = this.#scope;
        invariant(scope);
        let scopePhaseCounts = this.#scopePhases.get(scope);
        invariant(scopePhaseCounts);
        scopePhaseCounts[type] += 1;
        this.#phases[type] += 1;
        if (this.#phases[type] !== 1)
            return;
        if (type === 'beforeUpdate') {
            this.#init.scheduler.addEventListener('beforeUpdate', this.#onBeforeUpdate);
        }
        else {
            this.#init.scheduler.addEventListener('commit', this.#onCommit);
        }
    }
    removeEventListener(type, listener, options) {
        let target = this.#activeTarget();
        target.removeEventListener(type, listener, typeof options === 'boolean' ? { capture: options } : options);
        if (!listener || !isSchedulerPhaseType(type))
            return;
        let scope = this.#scope;
        invariant(scope);
        let scopePhaseCounts = this.#scopePhases.get(scope);
        invariant(scopePhaseCounts);
        scopePhaseCounts[type] = Math.max(0, scopePhaseCounts[type] - 1);
        this.#phases[type] = Math.max(0, this.#phases[type] - 1);
        if (this.#phases[type] !== 0)
            return;
        if (type === 'beforeUpdate') {
            this.#init.scheduler.removeEventListener('beforeUpdate', this.#onBeforeUpdate);
        }
        else {
            this.#init.scheduler.removeEventListener('commit', this.#onCommit);
        }
    }
    update() {
        return new Promise((resolve) => {
            let signal = this.#init.getRuntimeSignal();
            if (signal.aborted) {
                resolve(signal);
                return;
            }
            let binding = this.#init.getBinding();
            if (!binding) {
                resolve(signal);
                return;
            }
            binding.enqueueUpdate(resolve);
        });
    }
    queueTask(task) {
        this.#init.scheduler.enqueueTasks([
            () => {
                let binding = this.#init.getBinding();
                invariant(binding);
                task(binding.node, this.#init.getRuntimeSignal());
            },
        ]);
    }
    queueCommitTask(task) {
        this.#init.scheduler.enqueueCommitPhase([task]);
    }
    setActiveScope(scope) {
        this.#scope = scope;
        if (!scope)
            return;
        if (this.#targets.has(scope))
            return;
        this.#targets.set(scope, new TypedEventTarget());
        this.#scopePhases.set(scope, { beforeUpdate: 0, commit: 0 });
    }
    dispatchScopedEvent(scope, event) {
        let previousScope = this.#scope;
        this.#scope = scope;
        this.#targets.get(scope)?.dispatchEvent(event);
        this.#scope = previousScope;
    }
    releaseScope(scope) {
        let scopePhaseCounts = this.#scopePhases.get(scope);
        if (scopePhaseCounts) {
            this.#decrementPhase('beforeUpdate', scopePhaseCounts.beforeUpdate);
            this.#decrementPhase('commit', scopePhaseCounts.commit);
        }
        let controller = this.#signals.get(scope);
        if (controller) {
            controller.abort();
            this.#signals.delete(scope);
        }
        this.#scopePhases.delete(scope);
        this.#targets.delete(scope);
        if (this.#scope === scope) {
            this.#scope = undefined;
        }
    }
    #dispatchPhase(type, event) {
        let binding = this.#init.getBinding();
        if (!binding)
            return;
        if (!isBindingInUpdateScope(binding, event.parents))
            return;
        for (let [, target] of this.#targets) {
            let updateEvent = new Event(type);
            updateEvent.node = binding.node;
            target.dispatchEvent(updateEvent);
        }
    }
    #activeTarget() {
        let scope = this.#scope;
        invariant(scope);
        let target = this.#targets.get(scope);
        invariant(target);
        return target;
    }
    #scopeSignal(scope) {
        let controller = this.#signals.get(scope);
        if (!controller) {
            controller = new AbortController();
            this.#signals.set(scope, controller);
        }
        return controller.signal;
    }
    #decrementPhase(type, amount) {
        if (amount <= 0)
            return;
        this.#phases[type] = Math.max(0, this.#phases[type] - amount);
        if (this.#phases[type] !== 0)
            return;
        if (type === 'beforeUpdate') {
            this.#init.scheduler.removeEventListener('beforeUpdate', this.#onBeforeUpdate);
        }
        else {
            this.#init.scheduler.removeEventListener('commit', this.#onCommit);
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
function dispatchMixinNodeEvent(handle, scope, type, node, parent, key) {
    let event = new Event(type);
    event.node = node;
    event.parent = parent;
    event.key = key;
    handle.dispatchScopedEvent(scope, event);
}
function dispatchMixinBeforeRemove(handle, scope, persistNode) {
    let event = new Event('beforeRemove');
    event.persistNode = persistNode;
    handle.dispatchScopedEvent(scope, event);
}
function queueMixinNodeEvent(handle, scope, type, node, parent, key) {
    handle.queueCommitTask(() => {
        dispatchMixinNodeEvent(handle, scope, type, node, parent, key);
    });
}
function queueMixinRemove(handle, scope) {
    handle.queueCommitTask(() => {
        handle.dispatchScopedEvent(scope, new Event('remove'));
        handle.releaseScope(scope);
    });
}
function dispatchMixinRemoveEvent(state) {
    let runners = state?.runners;
    if (!runners?.length)
        return;
    let handle = state?.handle;
    if (!handle)
        return;
    for (let entry of runners) {
        handle.dispatchScopedEvent(entry.scope, new Event('remove'));
    }
}
function finalizeMixinTeardown(state) {
    dispatchMixinRemoveEvent(state);
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
export function dispatchMixinUpdateEvent(state, type) {
    let node = state?.binding?.node;
    if (!node)
        return;
    let runners = state?.runners;
    if (!runners?.length)
        return;
    let handle = state?.handle;
    if (!handle)
        return;
    for (let entry of runners) {
        let event = new Event(type);
        event.node = node;
        handle.dispatchScopedEvent(entry.scope, event);
    }
}
function isSchedulerPhaseType(type) {
    return type === 'beforeUpdate' || type === 'commit';
}
function isBindingInUpdateScope(binding, parents) {
    if (parents.length === 0)
        return false;
    let node = binding.node;
    for (let parent of parents) {
        let parentNode = parent;
        if (parentNode === node)
            return true;
        if (parentNode.contains(node))
            return true;
    }
    return false;
}
function resolveMixDescriptors(props) {
    let mix = props.mix;
    if (!mix)
        return [];
    return (Array.isArray(mix) ? mix.filter(Boolean) : [mix]);
}
function withoutMix(props) {
    if (!('mix' in props))
        return props;
    let output = { ...props };
    delete output.mix;
    return output;
}
function withoutMixinTreeProps(props) {
    if (!('children' in props) && !('innerHTML' in props))
        return props;
    let output = { ...props };
    delete output.children;
    delete output.innerHTML;
    return output;
}
function sanitizeReturnedMixinProps(props) {
    if (!('children' in props) && !('innerHTML' in props))
        return props;
    console.error(new Error('mixins must not return children or innerHTML'));
    return withoutMixinTreeProps(props);
}
function resolveReturnedMixDescriptors(value) {
    let descriptors = [];
    if (!collectReturnedMixDescriptors(value, descriptors)) {
        return null;
    }
    return descriptors;
}
function collectReturnedMixDescriptors(value, output) {
    if (!value) {
        return true;
    }
    if (Array.isArray(value)) {
        for (let item of value) {
            if (!collectReturnedMixDescriptors(item, output)) {
                return false;
            }
        }
        return true;
    }
    if (!isMixinDescriptor(value)) {
        return false;
    }
    output.push(value);
    return true;
}
function isRemixElement(value) {
    if (!value || typeof value !== 'object')
        return false;
    return value.$rmx === true;
}
function isMixinDescriptor(value) {
    if (!value || typeof value !== 'object' || isRemixElement(value)) {
        return false;
    }
    let descriptor = value;
    return typeof descriptor.type === 'function' && Array.isArray(descriptor.args);
}
function isMixinElement(value) {
    if (typeof value !== 'function')
        return false;
    return '__rmxMixinElementType' in value;
}
function normalizeMixinRunner(result, handle) {
    if (typeof result === 'function' && !isMixinElement(result)) {
        return result;
    }
    if (result === undefined) {
        return () => handle.element;
    }
    return () => result;
}
//# sourceMappingURL=mixin.js.map