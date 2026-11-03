import { attrs, createMixin, css, } from '@remix-run/component';
import { anchor as positionAnchor } from './anchor.js';
import { registerDismissableLayer } from './lib/dismissable-layer.js';
import { finishAnimations } from './lib/finish-animations.js';
import { lockScroll } from './lib/scroll-lock.js';
function PopoverProvider(handle) {
    handle.context.set({
        hideFocusTarget: null,
        showFocusTarget: null,
        surface: null,
        anchor: null,
    });
    return () => handle.props.children;
}
const anchorMixin = createMixin((handle) => {
    let context = handle.context.get(PopoverProvider);
    return (options) => {
        handle.queueTask((node) => {
            context.anchor = { target: node, options };
        });
    };
}, { ssr: false });
function anchorContains(anchor, target) {
    return anchor?.target instanceof HTMLElement && anchor.target.contains(target);
}
const surfaceMixin = createMixin((handle) => {
    let openProp = false;
    let transition = 0;
    let cleanupAnchor = () => { };
    let unlockScroll = () => { };
    let disposeLayer = () => { };
    let currentOptions;
    let context = handle.context.get(PopoverProvider);
    function cleanup() {
        disposeLayer();
        cleanupAnchor();
        unlockScroll();
    }
    handle.queueTask((node, signal) => {
        context.surface = node;
        signal.addEventListener('abort', () => {
            transition++;
            node.removeAttribute('data-open');
            cleanup();
            if (context.surface === node) {
                context.surface = null;
            }
        });
    });
    return (options) => {
        currentOptions = options;
        let wasOpen = openProp;
        openProp = options.open;
        handle.queueTask((node, signal) => {
            if (openProp === wasOpen)
                return;
            let currentTransition = ++transition;
            if (openProp && !wasOpen) {
                let anchor = context.anchor;
                if (!anchor) {
                    throw new Error('popover.surface() requires a registered anchor before opening');
                }
                if (node.hasAttribute('data-open'))
                    return;
                node.setAttribute('data-open', '');
                cleanupAnchor = positionAnchor(node, anchor.target, anchor.options);
                unlockScroll = lockScroll(node.ownerDocument);
                disposeLayer = registerDismissableLayer(node, {
                    getParent: () => context.anchor?.source ??
                        (context.anchor?.target instanceof HTMLElement ? context.anchor.target : null),
                    onParentClose() {
                        transition++;
                        node.removeAttribute('data-open');
                        cleanup();
                        // A parent can close before a child portal has committed its new options.
                        queueMicrotask(() => {
                            if (!signal.aborted && currentOptions.open)
                                currentOptions.onHide();
                        });
                    },
                    dismissOnEscape: () => currentOptions.open,
                    dismissOnOutsideClick: () => currentOptions.open,
                    onDismiss(request) {
                        currentOptions.onHide(request.reason === 'escape-key'
                            ? { reason: 'escape-key' }
                            : { reason: 'outside-click', target: request.target });
                    },
                    isInside: (target) => currentOptions.closeOnAnchorClick === false && anchorContains(context.anchor, target),
                    stopOutsideClickPropagation: () => currentOptions.stopOutsideClickPropagation ?? true,
                }).dispose;
                // Descendant focus mixins register after their surface's queued work.
                queueMicrotask(() => {
                    if (!signal.aborted && node.hasAttribute('data-open'))
                        context.showFocusTarget?.focus();
                });
            }
            else if (!openProp && wasOpen) {
                function finishClose() {
                    if (signal.aborted || currentTransition !== transition)
                        return;
                    node.removeAttribute('data-open');
                    cleanup();
                    if (currentOptions.restoreFocusOnHide !== false)
                        context.hideFocusTarget?.focus();
                }
                let finished = finishAnimations([node]);
                if (finished)
                    void finished.then(finishClose);
                else
                    finishClose();
            }
        });
        return [
            attrs({ 'data-popover': '', 'data-state': options.open ? 'open' : 'closed' }),
            css({
                position: 'fixed',
                width: 'max-content',
                zIndex: 'calc(var(--rmx-layer-base, 0) + var(--rmx-layer-order, 0))',
                '&:not([data-open])': { display: 'none' },
            }),
        ];
    };
});
const focusOnShowMixin = createMixin((handle) => {
    handle.addEventListener('insert', (event) => {
        let context = handle.context.get(PopoverProvider);
        context.showFocusTarget = event.node;
    });
}, { ssr: false });
const focusOnHideMixin = createMixin((handle) => {
    handle.addEventListener('insert', (event) => {
        let context = handle.context.get(PopoverProvider);
        context.hideFocusTarget = event.node;
    });
}, { ssr: false });
export const Context = PopoverProvider;
export const anchor = anchorMixin;
export const surface = surfaceMixin;
export const focusOnHide = focusOnHideMixin;
export const focusOnShow = focusOnShowMixin;
//# sourceMappingURL=popover.js.map