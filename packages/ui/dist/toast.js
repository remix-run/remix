import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "@remix-run/component/jsx-runtime";
import { attrs, createMixin, css, on, ref, TypedEventTarget } from '@remix-run/component';
/**
 * Creates retained toast state independently of rendering. Timers run only while presented.
 * @param options Default notification policy.
 * @returns A manager with native EventTarget subscriptions.
 */
export function createToastManager(options = {}) {
    let defaultTimeout = options.defaultTimeout ?? false;
    if (typeof defaultTimeout !== 'function')
        validateTimeout(defaultTimeout);
    let storedToastItems = new Map();
    let reasons = new Set();
    let nextId = 0;
    function changed() {
        toastManager.dispatchEvent(new Event('change'));
    }
    function remaining(toastItem) {
        return Math.max(0, toastItem.remaining -
            (toastItem.started === null ? 0 : performance.now() - toastItem.started));
    }
    function stop(toastItem) {
        toastItem.remaining = remaining(toastItem);
        toastItem.started = null;
        clearTimeout(toastItem.timer);
    }
    function start(id, toastItem) {
        if (toastItem.timeout === false || toastItem.presentations.size === 0 || reasons.size > 0)
            return;
        toastItem.started = performance.now();
        toastItem.timer = setTimeout(() => toastManager.close(id), toastItem.remaining);
    }
    function validateTimeout(value) {
        if (value !== false && (!Number.isFinite(value) || value < 0))
            throw new RangeError('Toast timeout must be false or finite and non-negative');
        return value;
    }
    class ToastStore extends TypedEventTarget {
        get toastItems() {
            return Object.freeze([...storedToastItems].reverse().map(([id, toastItem]) => Object.freeze({
                id,
                revision: toastItem.revision,
                title: toastItem.options.title,
                description: toastItem.options.description,
                announcement: toastItem.options.announcement,
                data: toastItem.options.data,
                timeout: toastItem.timeout,
                remaining: remaining(toastItem),
                paused: toastItem.started === null,
                presented: toastItem.presentations.size > 0,
            })));
        }
        add(options) {
            let id = options.id ?? `toast-${++nextId}`;
            while (options.id === undefined && storedToastItems.has(id))
                id = `toast-${++nextId}`;
            let previous = storedToastItems.get(id);
            let lifetime = validateTimeout(options.timeout ??
                (typeof defaultTimeout === 'function' ? defaultTimeout(options) : defaultTimeout));
            if (previous)
                stop(previous);
            let toastItem = {
                revision: previous ? previous.revision + 1 : 0,
                options: { ...options },
                timeout: lifetime,
                remaining: lifetime === false ? 0 : lifetime,
                started: null,
                presentations: previous?.presentations ?? new Set(),
            };
            storedToastItems.set(id, toastItem);
            start(id, toastItem);
            changed();
            return id;
        }
        close(id) {
            if (id === undefined) {
                for (let toastItem of storedToastItems.values())
                    stop(toastItem);
                storedToastItems.clear();
            }
            else {
                let toastItem = storedToastItems.get(id);
                if (!toastItem)
                    return;
                stop(toastItem);
                storedToastItems.delete(id);
            }
            changed();
        }
        pause(reason) {
            if (reasons.has(reason))
                return;
            for (let toastItem of storedToastItems.values())
                stop(toastItem);
            reasons.add(reason);
            changed();
        }
        resume(reason) {
            if (!reasons.delete(reason))
                return;
            if (reasons.size === 0)
                for (let [id, toastItem] of storedToastItems)
                    start(id, toastItem);
            changed();
        }
        present(id, signal) {
            let toastItem = storedToastItems.get(id);
            if (!toastItem || signal.aborted)
                return;
            let token = Symbol();
            toastItem.presentations.add(token);
            if (toastItem.presentations.size === 1)
                start(id, toastItem);
            signal.addEventListener('abort', () => {
                // An add with the same id replaces the stored toast item but retains its presentations.
                let current = storedToastItems.get(id);
                if (!current || !current.presentations.delete(token))
                    return;
                if (current.presentations.size === 0)
                    stop(current);
                changed();
            }, { once: true });
            changed();
        }
    }
    let toastManager = new ToastStore();
    return toastManager;
}
function ToastScope(handle) {
    handle.context.set(handle.props.value);
    return () => handle.props.children;
}
const hidden = css({
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
    border: 0,
});
const mountedManagers = new WeakSet();
function isElement(target) {
    return (typeof target === 'object' &&
        target !== null &&
        'nodeType' in target &&
        target.nodeType === 1 &&
        'focus' in target);
}
function activeElement(doc) {
    let active = doc.activeElement;
    while (active?.shadowRoot?.activeElement)
        active = active.shadowRoot.activeElement;
    return isElement(active) ? active : null;
}
function contains(container, target) {
    while (target) {
        if (container.contains(target))
            return true;
        let root = target.getRootNode();
        target = 'host' in root && isElement(root.host) ? root.host : null;
    }
    return false;
}
function focusElement(node, visible = false) {
    let options = {
        preventScroll: true,
        focusVisible: visible,
    };
    node.focus(options);
}
/**
 * Connects retained notifications to consumer markup, announcements and focus coordination.
 * @param handle Component lifetime and typed manager props.
 * @returns A reactive renderer for the collection and announcements.
 */
export function Context(handle) {
    let toastManager = handle.props.manager;
    let limit = handle.props.limit ?? Infinity;
    let region;
    let returnTo;
    let touch = Symbol('touch');
    let hover = Symbol('hover');
    let focus = Symbol('focus');
    let visibility = Symbol('visibility');
    let windowBlur = Symbol('window blur');
    let touchEngaged = false;
    let hovered = false;
    let focused = false;
    let entering = false;
    let collapseAfterExit = false;
    let presentations = new Map();
    let previous = toastManager.toastItems.map((toastItem) => toastItem.id);
    function restoreFocus() {
        if (!region || !returnTo)
            return false;
        let doc = region.ownerDocument;
        if (returnTo === doc.body)
            activeElement(doc)?.blur();
        else if (returnTo.isConnected)
            focusElement(returnTo);
        let restored = !contains(region, activeElement(doc));
        if (restored)
            returnTo = undefined;
        return restored;
    }
    function refresh() {
        let toastItems = toastManager.toastItems;
        let available = new Set(toastItems.slice(0, limit).map((toastItem) => toastItem.id));
        let active = region && activeElement(region.ownerDocument);
        if (region && !available.size && active && contains(region, active)) {
            if (!restoreFocus())
                active.blur();
            active = activeElement(region.ownerDocument);
        }
        for (let [id, node] of presentations) {
            if (!available.has(id) && active && contains(node, active)) {
                if (!focused && !active.matches(':focus-visible')) {
                    active.blur();
                    continue;
                }
                let index = previous.indexOf(id);
                let candidates = [...previous.slice(index + 1), ...previous.slice(0, index).reverse()];
                let target = candidates
                    .filter((candidate) => available.has(candidate))
                    .map((candidate) => presentations.get(candidate))
                    .find((candidate) => candidate?.isConnected && !candidate.inert);
                if (target)
                    focusElement(target, true);
                else if (!restoreFocus())
                    active.blur();
            }
        }
        // Focusing a neighbour may run consumer handlers that close more notifications.
        toastItems = toastManager.toastItems;
        available = new Set(toastItems.slice(0, limit).map((toastItem) => toastItem.id));
        previous = toastItems.map((toastItem) => toastItem.id);
        for (let [id, node] of presentations) {
            let unavailable = !available.has(id);
            node.inert = unavailable;
            if (unavailable)
                node.setAttribute('aria-hidden', 'true');
            else
                node.removeAttribute('aria-hidden');
        }
    }
    let state = {
        toastManager,
        get limit() {
            return limit;
        },
        focusGuard(previous) {
            let target = previous === region
                ? toastManager.toastItems
                    .slice(0, limit)
                    .map((toastItem) => presentations.get(toastItem.id))
                    .find((node) => node?.isConnected && !node.inert)
                : undefined;
            if (target)
                focusElement(target, true);
            else
                restoreFocus();
        },
        get hasReturnTarget() {
            return returnTo !== undefined;
        },
        get expanded() {
            return hovered || focused || touchEngaged;
        },
        registerItem(id, node) {
            presentations.set(id, node);
            refresh();
        },
        unregisterItem(id, node) {
            if (presentations.get(id) !== node)
                return;
            presentations.delete(id);
            if (collapseAfterExit &&
                ![...presentations.keys()].some((id) => !toastManager.toastItems.some((toastItem) => toastItem.id === id))) {
                collapseAfterExit = false;
                hovered = false;
                toastManager.resume(hover);
            }
            if (!toastManager.toastItems.length) {
                collapseAfterExit = false;
                touchEngaged = hovered = false;
                toastManager.resume(touch);
                toastManager.resume(hover);
            }
            refresh();
        },
        registerRoot(node, options, signal) {
            if (region && region !== node)
                throw new Error('Mount only one toast.root() per Context');
            region = node;
            let doc = node.ownerDocument;
            let win = doc.defaultView;
            node.addEventListener('pointerdown', (event) => {
                if (event.pointerType !== 'touch' || !event.isPrimary || event.button !== 0)
                    return;
                touchEngaged = true;
                toastManager.pause(touch);
                void handle.update();
            }, { signal });
            doc.addEventListener('pointerdown', (event) => {
                if (!touchEngaged ||
                    event.pointerType !== 'touch' ||
                    !event.isPrimary ||
                    event.button !== 0 ||
                    event.composedPath().includes(node))
                    return;
                touchEngaged = hovered = false;
                let active = activeElement(doc);
                if (active && contains(node, active))
                    active.blur();
                toastManager.resume(touch);
                toastManager.resume(hover);
                void handle.update();
            }, { capture: true, signal });
            node.addEventListener('pointerenter', (event) => {
                if (event.pointerType === 'touch')
                    return;
                hovered = true;
                collapseAfterExit = false;
                toastManager.pause(hover);
                void handle.update();
            }, { signal });
            node.addEventListener('pointerleave', () => {
                if ([...presentations.keys()].some((id) => !toastManager.toastItems.some((toastItem) => toastItem.id === id))) {
                    collapseAfterExit = true;
                    return;
                }
                hovered = false;
                toastManager.resume(hover);
                void handle.update();
            }, { signal });
            node.addEventListener('focusin', (event) => {
                let active = activeElement(doc);
                if (!active || (!entering && !active.matches(':focus-visible')))
                    return;
                if (!entering && isElement(event.relatedTarget) && !contains(node, event.relatedTarget))
                    returnTo = event.relatedTarget;
                focused = true;
                toastManager.pause(focus);
                refresh();
                void handle.update();
            }, { signal });
            node.addEventListener('focusout', (event) => {
                if (isElement(event.relatedTarget) && contains(node, event.relatedTarget))
                    return;
                focused = false;
                toastManager.resume(focus);
                refresh();
                void handle.update();
            }, { signal });
            node.addEventListener('keydown', (event) => {
                if (event.defaultPrevented)
                    return;
                if (event.key === (options().hotkey ?? 'F6')) {
                    event.stopPropagation();
                    if (restoreFocus())
                        event.preventDefault();
                    return;
                }
                if (event.key === 'Tab' &&
                    event.shiftKey &&
                    activeElement(doc) === node &&
                    restoreFocus()) {
                    event.preventDefault();
                }
            }, { signal });
            doc.addEventListener('keydown', (event) => {
                if (event.key !== (options().hotkey ?? 'F6') ||
                    event.altKey ||
                    event.ctrlKey ||
                    event.metaKey ||
                    event.shiftKey ||
                    event.defaultPrevented ||
                    !node.getClientRects().length ||
                    node.closest('[inert]'))
                    return;
                if (!toastManager.toastItems.length || contains(node, activeElement(doc)))
                    return;
                returnTo = activeElement(doc) ?? doc.body;
                entering = true;
                focusElement(node, true);
                entering = false;
                if (activeElement(doc) === node)
                    event.preventDefault();
            }, { signal });
            function onVisibility() {
                if (doc.hidden)
                    toastManager.pause(visibility);
                else
                    toastManager.resume(visibility);
            }
            doc.addEventListener('visibilitychange', onVisibility, { signal });
            win?.addEventListener('blur', (event) => {
                if (event.target === win)
                    toastManager.pause(windowBlur);
            }, { signal });
            win?.addEventListener('focus', (event) => {
                if (event.target === win)
                    toastManager.resume(windowBlur);
            }, { signal });
            onVisibility();
            signal.addEventListener('abort', () => {
                region = undefined;
                returnTo = undefined;
                touchEngaged = hovered = focused = false;
                toastManager.resume(touch);
                toastManager.resume(hover);
                toastManager.resume(focus);
                toastManager.resume(visibility);
                toastManager.resume(windowBlur);
            }, { once: true });
            refresh();
        },
    };
    function sync() {
        refresh();
        void handle.update();
    }
    handle.queueTask(() => {
        if (mountedManagers.has(toastManager))
            throw new Error('Mount only one toast.Context per manager');
        mountedManagers.add(toastManager);
        toastManager.addEventListener('change', sync, { signal: handle.signal });
        sync();
        handle.signal.addEventListener('abort', () => mountedManagers.delete(toastManager), {
            once: true,
        });
    });
    return () => {
        let nextLimit = handle.props.limit ?? Infinity;
        if (handle.props.limit !== undefined && (!Number.isInteger(nextLimit) || nextLimit < 1))
            throw new RangeError('Toast limit must be a positive integer');
        if (limit !== nextLimit) {
            limit = nextLimit;
            refresh();
        }
        return (_jsxs(ToastScope, { value: state, children: [handle.props.children(toastManager.toastItems), _jsx("div", { "aria-live": "polite", "aria-atomic": "false", "aria-relevant": "additions text", mix: hidden, children: toastManager.toastItems
                        .filter((toastItem) => toastItem.presented)
                        .map((toastItem) => (_jsx("div", { "aria-atomic": "true", children: toastItem.announcement !== undefined ? (toastItem.announcement) : (_jsxs(_Fragment, { children: [_jsx("div", { children: toastItem.title }), _jsx("div", { children: toastItem.description })] })) }, JSON.stringify([toastItem.id, toastItem.revision])))) })] }));
    };
}
/** A named notification region with keyboard entry. */
export const root = createMixin((handle) => {
    let context = handle.context.get(ToastScope);
    if (!context)
        throw new Error('toast.root() must be rendered inside toast.Context');
    let options;
    return (nextOptions) => {
        if (typeof nextOptions?.label !== 'string' || !nextOptions.label.trim())
            throw new Error('toast.root() requires a non-empty label');
        options = nextOptions;
        return [
            attrs({
                role: 'region',
                'aria-label': options.label,
                tabIndex: -1,
                'data-expanded': context.expanded ? '' : undefined,
            }),
            ref((node, signal) => context.registerRoot(node, () => options, signal)),
        ];
    };
});
function FocusGuard(handle) {
    let context = handle.context.get(ToastScope);
    return () => (_jsx("span", { tabIndex: handle.props.active ? 0 : -1, "aria-hidden": "true", "data-toast-focus-guard": "", mix: [hidden, on('focus', (event) => context.focusGuard(event.relatedTarget))] }));
}
/**
 * Scopes a notification's content and controls and coordinates keyboard boundary guards.
 * @param handle Notification identity and consumer-owned markup.
 * @returns The notification's markup with shared item context.
 */
export function ItemContext(handle) {
    let context = handle.context.get(ToastScope);
    if (!context)
        throw new Error('toast.ItemContext must be rendered inside toast.Context');
    let parts = new Map();
    function updatePart(part, node) {
        let previous = parts.get(part);
        let present = node.textContent !== '' || node.querySelector('[aria-label],img[alt]') !== null;
        if (present && (previous?.node !== node || previous.id !== node.id)) {
            parts.set(part, { node, id: node.id });
            void handle.update();
        }
        else if (!present && previous?.node === node) {
            parts.delete(part);
            void handle.update();
        }
    }
    handle.context.set({
        get id() {
            return handle.props.value;
        },
        get titleId() {
            return parts.get('title')?.id;
        },
        get descriptionId() {
            return parts.get('description')?.id;
        },
        updatePart,
        registerPart(part, node, signal) {
            let sync = () => {
                if (!signal.aborted)
                    updatePart(part, node);
            };
            sync();
            let Observer = node.ownerDocument.defaultView?.MutationObserver;
            let observer = Observer && new Observer(sync);
            observer?.observe(node, {
                childList: true,
                characterData: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['id', 'aria-label', 'alt'],
            });
            signal.addEventListener('abort', () => {
                observer?.disconnect();
                if (parts.get(part)?.node === node) {
                    parts.delete(part);
                    if (!handle.signal.aborted)
                        void handle.update();
                }
            }, { once: true });
        },
    });
    return () => {
        let available = context.toastManager.toastItems.slice(0, context.limit);
        let first = available[0]?.id === handle.props.value;
        let last = available.at(-1)?.id === handle.props.value;
        return (_jsxs(_Fragment, { children: [_jsx(FocusGuard, { active: context.hasReturnTarget && first }), handle.props.children, _jsx(FocusGuard, { active: context.hasReturnTarget && last })] }));
    };
}
/**
 * Gives the scoped toast dialog semantics, presentation lifetime and focus recovery.
 * Without a title, supply an accessible name on the host with aria-label or aria-labelledby.
 */
export const item = createMixin((handle) => {
    let context = handle.context.get(ToastScope);
    let scoped = handle.context.get(ItemContext);
    if (!context || !scoped)
        throw new Error('toast.item() must be rendered inside toast.ItemContext');
    let presentation;
    let host;
    function connect(node) {
        presentation?.abort();
        presentation = new AbortController();
        host = node;
        context.registerItem(scoped.id, node);
        context.toastManager.present(scoped.id, presentation.signal);
    }
    handle.addEventListener('insert', (event) => connect(event.node));
    handle.addEventListener('reclaimed', (event) => connect(event.node));
    handle.addEventListener('beforeRemove', () => presentation?.abort());
    function disconnect() {
        presentation?.abort();
        if (host)
            context.unregisterItem(scoped.id, host);
    }
    handle.addEventListener('remove', disconnect);
    handle.signal.addEventListener('abort', disconnect, { once: true });
    return (options = {}) => {
        let toastItems = context.toastManager.toastItems;
        let index = toastItems.findIndex((toastItem) => toastItem.id === scoped.id);
        let toastItem = toastItems[index];
        let limited = index >= context.limit;
        return [
            options.countdown && toastItem ? countdownAnimation(toastItem) : undefined,
            attrs({
                inert: limited || !toastItem ? true : undefined,
                'aria-hidden': limited || !toastItem ? 'true' : undefined,
                'data-limited': limited ? '' : undefined,
                role: 'dialog',
                'aria-modal': 'false',
                'aria-labelledby': scoped.titleId,
                'aria-describedby': scoped.descriptionId,
                tabIndex: 0,
                'data-toast': '',
            }),
            on('keydown', (event) => {
                if (event.defaultPrevented ||
                    event.key !== 'Escape' ||
                    !host ||
                    !contains(host, activeElement(host.ownerDocument)))
                    return;
                context.toastManager.close(scoped.id);
            }),
        ];
    };
});
function labelPart(part) {
    return createMixin((handle) => {
        let scoped = handle.context.get(ItemContext);
        if (!scoped)
            throw new Error(`toast.${part}() must be rendered inside toast.ItemContext`);
        handle.addEventListener('commit', () => {
            handle.queueTask((node) => scoped.updatePart(part, node));
        });
        return (props) => [
            attrs({ id: props.id ?? `${handle.id}-${part}` }),
            ref((node, signal) => scoped.registerPart(part, node, signal)),
        ];
    });
}
/** Connects the consumer-owned heading to the toast's accessible name. */
export const title = labelPart('title');
/** Connects the consumer-owned supporting content to the toast's accessible description. */
export const description = labelPart('description');
/** Closes the scoped toast. Supply a native button and its translated text or accessible label. */
export const close = createMixin((handle) => {
    let scoped = handle.context.get(ItemContext);
    let context = handle.context.get(ToastScope);
    if (!scoped || !context)
        throw new Error('toast.close() must be rendered inside toast.ItemContext');
    return (props) => [
        attrs({
            type: props.type ?? 'button',
        }),
        on('click', (event) => {
            if (!event.defaultPrevented)
                context.toastManager.close(scoped.id);
        }),
    ];
});
let countdownPropertyRegistered = false;
const countdownAnimation = createMixin((handle) => {
    let clock;
    let animation;
    handle.addEventListener('remove', () => animation?.cancel());
    handle.signal.addEventListener('abort', () => animation?.cancel(), { once: true });
    function synchronize() {
        handle.queueTask((node) => {
            if (!countdownPropertyRegistered) {
                CSS.registerProperty({
                    name: '--toast-countdown',
                    syntax: '<number>',
                    inherits: true,
                    initialValue: '1',
                });
                countdownPropertyRegistered = true;
            }
            animation?.cancel();
            if (clock.timeout === false)
                return;
            animation = node.animate([{ '--toast-countdown': '1' }, { '--toast-countdown': '0' }], {
                duration: clock.timeout,
                fill: 'both',
                easing: 'linear',
            });
            animation.currentTime = clock.timeout - clock.remaining;
            if (clock.paused)
                animation.pause();
        });
    }
    return (nextClock) => {
        clock = nextClock;
        synchronize();
        return undefined;
    };
});
//# sourceMappingURL=toast.js.map