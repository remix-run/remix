// interactions ------------------------------------------------------------------------------------
/**
 * ### Description
 *
 * Defines an interaction type with its setup function.
 *
 * ### Example
 *
 * ```ts
 * import { defineInteraction, on } from 'remix/interaction'
 *
 * // define the interaction
 * export let keydownEnter = defineInteraction('my:keydown-enter', KeydownEnter)
 *
 * // Provide type safety for consumers
 * declare global {
 *   interface HTMLElementEventMap {
 *     [keydownEnter]: KeyboardEvent
 *   }
 * }
 *
 * // setup the interaction
 * function KeydownEnter(handle: Interaction) {
 *   handle.on(handle.target, {
 *     keydown(event) {
 *       if (event.key === 'Enter') {
 *         handle.target.dispatchEvent(new KeyboardEvent(keydownEnter, { key: 'Enter' }))
 *       }
 *     },
 *   })
 * }
 *
 * // then consumers use the string to bind the interaction
 * on(button, {
 *   [keydownEnter](event) {
 *     console.log('Enter key pressed')
 *   },
 * })
 * ```
 *
 * @param type The unique string identifier for this interaction type
 * @param interaction The setup function that configures the interaction
 * @returns The type string, for use as an event name
 */
export function defineInteraction(type, interaction) {
    interactions.set(type, interaction);
    return type;
}
/**
 * ### Description
 *
 * Creates an event container on a target with reentry protection and efficient
 * listener updates (primarily for vdom integrations). If you don't need to
 * update listeners in place, you can use `on` instead.
 *
 * ### Example
 *
 * ```ts
 * let button = document.createElement('button')
 * let container = createContainer(button)
 * container.set({
 *   click(event, signal) {
 *     console.log('clicked')
 *   },
 * })
 * ```
 *
 * Errors thrown in listeners are dispatched as `ErrorEvent` on the target
 * element with `bubbles: true`, allowing them to propagate up the DOM tree.
 *
 * @param target The event target to wrap (DOM element, window, document, or any EventTarget)
 * @param options Optional configuration for the container
 * @returns An `EventsContainer` with `dispose()` and `set()` methods
 */
export function createContainer(target, options) {
    let disposed = false;
    let { signal } = options ?? {};
    let bindings = {};
    function disposeAll() {
        if (disposed)
            return;
        disposed = true;
        for (let type in bindings) {
            let existing = bindings[type];
            if (existing) {
                for (let binding of existing) {
                    binding.dispose();
                }
            }
        }
    }
    if (signal) {
        signal.addEventListener('abort', disposeAll, { once: true });
    }
    return {
        dispose: disposeAll,
        set: (listeners) => {
            if (disposed) {
                throw new Error('Container has been disposed');
            }
            let listenerKeys = new Set(Object.keys(listeners));
            // Dispose bindings for types not in the new listeners
            for (let type in bindings) {
                let eventType = type;
                if (!listenerKeys.has(eventType)) {
                    let existing = bindings[eventType];
                    if (existing) {
                        for (let binding of existing) {
                            binding.dispose();
                        }
                        delete bindings[eventType];
                    }
                }
            }
            // TODO: figure out if we can remove this cast
            for (let type of listenerKeys) {
                let raw = listeners[type];
                if (raw == null)
                    continue;
                // this function was a bit vibe coded, can probably be simplified w/o
                // all the weird type gymnastics and funny inline function definition
                function updateTypeBindings(type, raw) {
                    let descriptors = normalizeDescriptors(raw);
                    let existing = bindings[type];
                    if (!existing) {
                        bindings[type] = descriptors.map((d) => {
                            let { listener, ...options } = d;
                            return createBinding(target, type, listener, options);
                        });
                        return;
                    }
                    // Update existing bindings in place by index
                    let min = Math.min(existing.length, descriptors.length);
                    for (let i = 0; i < min; i++) {
                        let d = descriptors[i];
                        let b = existing[i];
                        let { listener, ...options } = d;
                        if (optionsChanged(options, b.options)) {
                            b.rebind(listener, options);
                        }
                        else {
                            b.setListener(listener);
                        }
                    }
                    // Add new bindings for any extra descriptors
                    if (descriptors.length > existing.length) {
                        for (let i = existing.length; i < descriptors.length; i++) {
                            let d = descriptors[i];
                            let { listener, ...options } = d;
                            existing.push(createBinding(target, type, listener, options));
                        }
                    }
                    // Dispose any extra existing bindings not present anymore
                    if (existing.length > descriptors.length) {
                        for (let i = descriptors.length; i < existing.length; i++) {
                            existing[i].dispose();
                        }
                        existing.length = descriptors.length;
                    }
                }
                updateTypeBindings(type, raw);
            }
        },
    };
}
// on ----------------------------------------------------------------------------------------------
/**
 * ### Description
 *
 * Add event listeners with async reentry protection and semantic Interactions. Shorthand for `createContainer` without options.
 *
 * @example
 * import { on } from 'remix/interaction'
 * import { longPress } from 'remix/interaction/press'
 *
 * let button = document.createElement('button')
 * let dispose = on(button, {
 *   click(event, signal) {
 *     console.log('clicked')
 *   },
 *   [longPress](event) {
 *     console.log('long pressed')
 *   },
 * })
 *
 * // later
 * dispose()
 *
 * @param target The event target to add listeners to
 * @param listeners The event listeners to add
 * @returns A function to dispose all listeners
 */
export function on(target, listeners) {
    let container = createContainer(target);
    container.set(listeners);
    return container.dispose;
}
// descriptors -------------------------------------------------------------------------------------
// TypedEventTarget --------------------------------------------------------------------------------
/**
 * An `EventTarget` subclass with typed event maps.
 */
export class TypedEventTarget extends EventTarget {
}
// internal ----------------------------------------------------------------------------------------
let interactions = new Map();
let initializedTargets = new WeakMap();
class InteractionHandle {
    target;
    signal;
    constructor(target, signal) {
        this.target = target;
        this.signal = signal;
    }
    on(target, listeners) {
        let container = createContainer(target, { signal: this.signal });
        container.set(listeners);
    }
}
function normalizeDescriptors(raw) {
    if (Array.isArray(raw)) {
        return raw.map((item) => (isDescriptor(item) ? item : { listener: item }));
    }
    return [isDescriptor(raw) ? raw : { listener: raw }];
}
function isDescriptor(value) {
    return typeof value === 'object' && value !== null && 'listener' in value;
}
function dispatchError(target, error) {
    target.dispatchEvent(new ErrorEvent('error', { error, bubbles: true }));
}
/**
 * Encapsulates a binding between an event type and a listener.
 *
 * - Adds reentry signal for async listeners (when listener.length >= 2)
 * - Efficiently updates listeners in place with simple diff (useful for
 *   vdom integrations)
 *
 * @param target The event target to bind to
 * @param type The event type to listen for
 * @param listener The listener function to call
 * @param options The event listener options
 * @returns The binding object for managing the listener
 */
function createBinding(target, type, listener, options) {
    let reentry = null;
    let interactionController = null;
    let disposed = false;
    // Track if current listener needs signal (length >= 2: event + signal)
    let needsSignal = listener.length >= 2;
    function abort() {
        if (reentry) {
            reentry.abort(new DOMException('', 'EventReentry'));
            reentry = new AbortController();
        }
    }
    let wrappedListener = (event) => {
        if (needsSignal) {
            abort();
            if (!reentry)
                reentry = new AbortController();
        }
        try {
            // TODO: figure out if we can remove this cast
            let result = listener(event, reentry?.signal);
            if (result instanceof Promise) {
                result.catch((error) => dispatchError(target, error));
            }
        }
        catch (error) {
            dispatchError(target, error);
        }
    };
    function bind() {
        target.addEventListener(type, wrappedListener, options);
    }
    function unbind() {
        abort();
        target.removeEventListener(type, wrappedListener, options);
    }
    function decrementInteractionRef() {
        let interaction = interactions.get(type);
        if (interaction) {
            let refCounts = initializedTargets.get(target);
            if (refCounts) {
                let count = refCounts.get(interaction) ?? 0;
                if (count > 0) {
                    count--;
                    if (count === 0) {
                        refCounts.delete(interaction);
                    }
                    else {
                        refCounts.set(interaction, count);
                    }
                }
            }
        }
    }
    function cleanup() {
        if (disposed)
            return;
        disposed = true;
        unbind();
        if (interactionController)
            interactionController.abort();
        decrementInteractionRef();
    }
    if (interactions.has(type)) {
        let interaction = interactions.get(type);
        let refCounts = initializedTargets.get(target);
        if (!refCounts) {
            refCounts = new Map();
            initializedTargets.set(target, refCounts);
        }
        let count = refCounts.get(interaction) ?? 0;
        if (count === 0) {
            // Only create AbortController for interactions that need cleanup coordination
            interactionController = new AbortController();
            let interactionContext = new InteractionHandle(target, interactionController.signal);
            interaction(interactionContext);
        }
        refCounts.set(interaction, count + 1);
    }
    bind();
    return {
        type,
        get options() {
            return options;
        },
        setListener(newListener) {
            listener = newListener;
            needsSignal = newListener.length >= 2;
        },
        rebind(newListener, newOptions) {
            unbind();
            options = newOptions;
            listener = newListener;
            needsSignal = newListener.length >= 2;
            bind();
        },
        dispose: cleanup,
    };
}
function optionsChanged(a, b) {
    return (a.capture !== b.capture || a.once !== b.once || a.passive !== b.passive || a.signal !== b.signal);
}
//# sourceMappingURL=interaction.js.map