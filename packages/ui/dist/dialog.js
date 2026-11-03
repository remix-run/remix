import { attrs, createMixin, css, on, ref, } from '@remix-run/component';
import { activateFocusScope } from './dialog/focus.js';
import { registerDismissableLayer } from './lib/dismissable-layer.js';
import { finishAnimations } from './lib/finish-animations.js';
import { lockScroll } from './lib/scroll-lock.js';
const DIALOG_CHANGE_EVENT = 'rmx:dialog-change';
/** A cancelable open-state request, dispatched from the dialog surface. */
export class DialogChangeEvent extends Event {
    /** The requested open state. */
    open;
    /** The interaction that requested the change. */
    reason;
    /** The original browser event, when the request came from an interaction. */
    sourceEvent;
    constructor(open, reason, sourceEvent) {
        super(DIALOG_CHANGE_EVENT, { bubbles: true, cancelable: true });
        this.open = open;
        this.reason = reason;
        this.sourceEvent = sourceEvent;
    }
}
function DialogProvider(handle) {
    let parent = handle.context.get(DialogProvider);
    let initialized = false;
    let uncontrolledOpen = false;
    let hasOpened = false;
    function getOpen() {
        if (!initialized) {
            uncontrolledOpen = handle.props.defaultOpen ?? false;
            initialized = true;
        }
        return (handle.props.open ?? uncontrolledOpen) && (parent?.open ?? true);
    }
    let context = {
        get open() {
            return getOpen();
        },
        get modal() {
            return handle.props.modal ?? true;
        },
        get parentSurface() {
            return parent?.surface ?? null;
        },
        get nested() {
            return !!parent;
        },
        get closeOnEscape() {
            return handle.props.closeOnEscape !== false;
        },
        get closeOnOutsideClick() {
            return handle.props.closeOnOutsideClick !== false;
        },
        surfaceId: `${handle.id}-dialog`,
        titleId: `${handle.id}-title`,
        descriptionId: `${handle.id}-description`,
        surface: null,
        backdrop: null,
        trigger: null,
        triggers: new Set(),
        openingEvent: undefined,
        closingReason: undefined,
        showFocusTarget: null,
        hideFocusTarget: null,
        isTrigger(target) {
            return (context.trigger?.contains(target) === true ||
                [...context.triggers].some((trigger) => trigger.contains(target)));
        },
        request(open, reason, sourceEvent, trigger) {
            if (open === getOpen() || handle.signal.aborted)
                return false;
            let event = new DialogChangeEvent(open, reason, sourceEvent);
            context.surface?.dispatchEvent(event);
            handle.props.onOpenChange?.(open, event);
            if (event.defaultPrevented)
                return false;
            context.closingReason = open ? undefined : reason;
            if (open) {
                context.trigger = trigger ?? null;
                context.openingEvent = sourceEvent;
            }
            if (handle.props.open === undefined) {
                uncontrolledOpen = open;
                void handle.update();
            }
            return true;
        },
        syncBackdrop() { },
        complete(open) {
            handle.props.onOpenChangeComplete?.(open);
        },
    };
    handle.context.set(context);
    handle.queueTask(() => {
        handle.props.ref?.({
            get open() {
                return context.open;
            },
            show(trigger) {
                context.request(true, 'programmatic', undefined, trigger);
            },
            close() {
                context.request(false, 'programmatic');
            },
        });
    });
    return () => {
        if (hasOpened && parent && !parent.open)
            uncontrolledOpen = false;
        hasOpened ||= getOpen();
        return handle.props.children;
    };
}
function getDialogContext(handle) {
    let context = handle.context.get(DialogProvider);
    if (!context)
        throw new Error('Dialog mixins require a dialog.Context ancestor');
    return context;
}
const triggerMixin = createMixin((handle) => {
    let context = getDialogContext(handle);
    return (props) => [
        attrs({
            type: props.type ?? 'button',
            'aria-haspopup': 'dialog',
            'aria-controls': context.surfaceId,
            'aria-expanded': context.open ? 'true' : 'false',
            'data-state': context.open ? 'open' : 'closed',
        }),
        ref((node, signal) => {
            context.triggers.add(node);
            signal.addEventListener('abort', () => context.triggers.delete(node));
        }),
        on('click', (event) => {
            if (event.defaultPrevented ||
                event.currentTarget.disabled ||
                event.currentTarget.getAttribute('aria-disabled') === 'true')
                return;
            context.request(!context.open, 'trigger', event, event.currentTarget);
        }),
    ];
});
function resolveFocus(target) {
    let resolved = typeof target === 'function' ? target() : target;
    return resolved === false ? false : resolved instanceof HTMLElement ? resolved : null;
}
const surfaceMixin = createMixin((handle) => {
    let context = getDialogContext(handle);
    let previousOpen = false;
    let transition = 0;
    let surfaceNode = null;
    let layer;
    let focusScope;
    let activeModal;
    let unlockScroll = () => { };
    let latestOptions = {};
    let previouslyFocused = null;
    context.syncBackdrop = () => {
        if (surfaceNode?.hasAttribute('data-open'))
            context.backdrop?.setAttribute('data-open', '');
        layer?.update();
    };
    function release() {
        layer?.dispose();
        layer = undefined;
        focusScope?.dispose({
            restoreFocus: context.closingReason !== 'focus-out' &&
                !(context.modal === false && context.closingReason === 'outside-click'),
        });
        focusScope = undefined;
        unlockScroll();
        unlockScroll = () => { };
        activeModal = undefined;
        previouslyFocused = null;
    }
    function hide(node) {
        node.removeAttribute('data-open');
        context.backdrop?.removeAttribute('data-open');
        release();
    }
    function configureFocus(node, initial) {
        unlockScroll();
        unlockScroll = context.modal === true ? lockScroll(node.ownerDocument) : () => { };
        activeModal = context.modal;
        if (focusScope) {
            focusScope.update({ modal: context.modal });
            return;
        }
        let openingEvent = context.openingEvent;
        let touch = openingEvent instanceof PointerEvent && openingEvent.pointerType === 'touch';
        focusScope = activateFocusScope(node, {
            modal: context.modal,
            initialFocus: initial
                ? (resolveFocus(latestOptions.initialFocus) ??
                    context.showFocusTarget ??
                    (touch ? node : null))
                : false,
            returnFocus: () => resolveFocus(latestOptions.finalFocus) ??
                context.hideFocusTarget ??
                context.trigger ??
                previouslyFocused,
            getBackdrop: () => context.backdrop,
            onFocusOutside(event) {
                if (event.target instanceof Node && context.isTrigger(event.target))
                    return;
                if (context.closeOnOutsideClick)
                    context.request(false, 'focus-out', event);
            },
        });
    }
    handle.addEventListener('insert', ({ node }) => {
        if (context.surface && context.surface !== node)
            throw new Error('dialog.Context supports one dialog.surface()');
        context.surface = node;
        surfaceNode = node;
    });
    handle.addEventListener('remove', () => {
        transition++;
        let node = surfaceNode;
        surfaceNode = null;
        if (!node)
            return;
        hide(node);
        if (context.surface === node) {
            context.surface = null;
            context.syncBackdrop = () => { };
        }
    });
    return (options = {}, props = options) => {
        latestOptions = options;
        let open = context.open;
        let changed = open !== previousOpen;
        previousOpen = open;
        handle.queueTask(async (node, signal) => {
            if (!props['aria-labelledby'] && !props['aria-label']) {
                if (node.querySelector(`[id="${context.titleId}"]`))
                    node.setAttribute('aria-labelledby', context.titleId);
                else
                    node.removeAttribute('aria-labelledby');
            }
            if (!props['aria-describedby']) {
                if (node.querySelector(`[id="${context.descriptionId}"]`))
                    node.setAttribute('aria-describedby', context.descriptionId);
                else
                    node.removeAttribute('aria-describedby');
            }
            if (open && !focusScope) {
                // Capture the opener before revealing content or applying initial focus.
                let active = node.ownerDocument.activeElement;
                while (active?.shadowRoot?.activeElement)
                    active = active.shadowRoot.activeElement;
                previouslyFocused = active instanceof HTMLElement ? active : null;
            }
            if (open && (changed || focusScope) && context.backdrop) {
                context.backdrop.setAttribute('data-open', '');
                layer?.update();
            }
            if (!changed) {
                if (open && focusScope && activeModal !== context.modal)
                    configureFocus(node, false);
                return;
            }
            let currentTransition = ++transition;
            if (open) {
                node.setAttribute('data-open', '');
                if (!layer) {
                    layer = registerDismissableLayer(node, {
                        getParent: () => context.trigger ?? context.parentSurface,
                        getBackdrop: () => context.backdrop,
                        dismissOnEscape: () => context.open && context.closeOnEscape,
                        dismissOnOutsideClick: () => context.open && context.closeOnOutsideClick,
                        stopOutsideClickPropagation: () => context.modal === true,
                        isInside: (target) => context.isTrigger(target),
                        onDismiss(request) {
                            context.request(false, request.reason, request.event);
                        },
                        onParentClose() {
                            transition++;
                            hide(node);
                            context.request(false, 'programmatic');
                        },
                    });
                }
                if (!focusScope)
                    configureFocus(node, true);
            }
            await finishAnimations(context.backdrop ? [node, context.backdrop] : [node]);
            if (signal.aborted || transition !== currentTransition)
                return;
            if (!open) {
                hide(node);
            }
            context.complete(open);
        });
        return [
            attrs({
                id: context.surfaceId,
                role: props.role ?? 'dialog',
                tabIndex: props.tabIndex ?? -1,
                'aria-modal': context.modal === false ? undefined : 'true',
                'aria-labelledby': props['aria-labelledby'] ?? (props['aria-label'] ? undefined : context.titleId),
                'aria-describedby': props['aria-describedby'] ?? context.descriptionId,
                'data-state': open ? 'open' : 'closed',
                'data-nested': context.nested ? '' : undefined,
            }),
            css({
                position: 'fixed',
                zIndex: 'calc(var(--rmx-layer-base, 0) + var(--rmx-layer-order, 0))',
                '&:not([data-open])': { display: 'none' },
            }),
        ];
    };
});
const backdropMixin = createMixin((handle) => {
    let context = getDialogContext(handle);
    return () => [
        attrs({
            'aria-hidden': 'true',
            'data-state': context.open ? 'open' : 'closed',
        }),
        css({
            position: 'fixed',
            inset: 0,
            zIndex: 'calc(var(--rmx-layer-base, 0) + var(--rmx-layer-order, 0))',
            '&:not([data-open])': { display: 'none' },
        }),
        ref((node, signal) => {
            context.backdrop = node;
            context.syncBackdrop();
            signal.addEventListener('abort', () => {
                node.removeAttribute('data-open');
                if (context.backdrop === node) {
                    context.backdrop = null;
                    context.syncBackdrop();
                }
            });
        }),
    ];
});
const closeMixin = createMixin((handle) => {
    let context = getDialogContext(handle);
    return (props) => [
        attrs({ type: props.type ?? 'button' }),
        on('click', (event) => {
            if (event.defaultPrevented ||
                event.currentTarget.disabled ||
                event.currentTarget.getAttribute('aria-disabled') === 'true')
                return;
            context.request(false, 'close', event);
        }),
    ];
});
const titleMixin = createMixin((handle) => {
    let context = getDialogContext(handle);
    return () => attrs({ id: context.titleId });
});
const descriptionMixin = createMixin((handle) => {
    let context = getDialogContext(handle);
    return () => attrs({ id: context.descriptionId });
});
const focusOnShowMixin = createMixin((handle) => {
    let context = getDialogContext(handle);
    return () => ref((node, signal) => {
        context.showFocusTarget = node;
        signal.addEventListener('abort', () => {
            if (context.showFocusTarget === node)
                context.showFocusTarget = null;
        });
    });
}, { ssr: false });
const focusOnHideMixin = createMixin((handle) => {
    let context = getDialogContext(handle);
    return () => ref((node, signal) => {
        context.hideFocusTarget = node;
        signal.addEventListener('abort', () => {
            if (context.hideFocusTarget === node)
                context.hideFocusTarget = null;
        });
    });
}, { ssr: false });
/** Provides state and registration for one dialog. */
export const Context = DialogProvider;
/** Adapts a native button to open or toggle its dialog. */
export const trigger = triggerMixin;
/** Adapts an app-owned element to the dialog surface. */
export const surface = surfaceMixin;
/** Registers an optional, app-styled backdrop below the surface. */
export const backdrop = backdropMixin;
/** Adapts a native button to request closing its dialog. */
export const close = closeMixin;
/** Associates a heading with the dialog's accessible name. */
export const title = titleMixin;
/** Associates text with the dialog's accessible description. */
export const description = descriptionMixin;
/** Registers the initial focus target inside the dialog. */
export const focusOnShow = focusOnShowMixin;
/** Registers a focus return target, overriding the opener. */
export const focusOnHide = focusOnHideMixin;
/**
 * Handles bubbling, cancelable dialog open-state requests.
 * @param handler The event handler.
 * @param captureBoolean Whether to listen during capture.
 * @returns An event mixin for the host element.
 */
export function onDialogChange(handler, captureBoolean) {
    return on(DIALOG_CHANGE_EVENT, handler, captureBoolean);
}
//# sourceMappingURL=dialog.js.map