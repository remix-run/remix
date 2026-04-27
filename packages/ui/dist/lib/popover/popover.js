import { attrs, createMixin, css, on, } from '@remix-run/component';
import { anchor as positionAnchor } from "../anchor/anchor.js";
import { onOutsideClick } from "../outside-click/outside-click-mixin.js";
import { theme } from "../theme/theme.js";
import { lockScroll } from "../utils/scroll-lock.js";
const popupViewportClampMaxHeight = '50dvh';
const popoverSurfaceTransitionCss = css({
    opacity: 0,
    '&:popover-open': {
        opacity: 1,
    },
    '&:not(:popover-open)': {
        pointerEvents: 'none',
        transition: 'opacity 180ms ease-in, overlay 180ms ease-in, display 180ms ease-in',
        transitionBehavior: 'allow-discrete',
    },
});
const popoverContentCss = css({
    flex: '1 1 auto',
    minHeight: 0,
    padding: theme.space.xs,
    overflow: 'auto',
    overscrollBehavior: 'contain',
});
const popoverSurfaceCss = css({
    position: 'fixed',
    inset: 'auto',
    margin: 0,
    padding: theme.space.none,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    minWidth: '12rem',
    maxWidth: `min(24rem, calc(100vw - (${theme.space.lg} * 2)))`,
    maxHeight: popupViewportClampMaxHeight,
    border: `1px solid ${theme.colors.border.subtle}`,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surface.lvl0,
    color: theme.colors.text.primary,
    overflow: 'hidden',
    boxShadow: `${theme.shadow.xs}, ${theme.shadow.md}`,
    '&::backdrop': {
        background: 'transparent',
    },
});
export const contentStyle = popoverContentCss;
export const surfaceStyle = [popoverSurfaceCss, popoverSurfaceTransitionCss];
function PopoverProvider(handle) {
    handle.context.set({
        hideFocusTarget: null,
        showFocusTarget: null,
        surface: null,
        anchor: null,
    });
    return (props) => props.children;
}
const anchorMixin = createMixin((handle) => {
    let context = handle.context.get(PopoverProvider);
    return (options) => {
        handle.queueTask((node) => {
            context.anchor = { node, options };
        });
    };
});
const surfaceMixin = createMixin((handle) => {
    let openProp = false;
    let cleanupAnchor = () => { };
    let unlockScroll = () => { };
    let context = handle.context.get(PopoverProvider);
    handle.queueTask((node, signal) => {
        context.surface = node;
        signal.addEventListener('abort', () => {
            if (context.surface === node) {
                context.surface = null;
            }
        });
    });
    return (options) => {
        let wasOpen = openProp;
        openProp = options.open;
        handle.queueTask(async (node) => {
            if (openProp && !wasOpen) {
                node.showPopover();
            }
            else if (!openProp && wasOpen) {
                node.hidePopover();
            }
        });
        return [
            attrs({ popover: 'manual' }),
            on('beforetoggle', (event) => {
                if (event.newState === 'open') {
                    cleanupAnchor = positionAnchor(event.currentTarget, context.anchor.node, context.anchor.options);
                    unlockScroll = lockScroll();
                }
                else if (event.newState === 'closed') {
                    cleanupAnchor();
                    unlockScroll();
                }
            }),
            on('toggle', async (event) => {
                if (event.newState === 'open') {
                    context.showFocusTarget?.focus();
                }
                else if (event.newState === 'closed' && options.restoreFocusOnHide !== false) {
                    context.hideFocusTarget?.focus();
                }
            }),
            on('keydown', (event) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    options.onHide({ reason: 'escape-key' });
                }
            }),
            onOutsideClick(openProp, (target) => {
                options.onHide({ reason: 'outside-click', target });
            }, (target) => options.closeOnAnchorClick === false && !!context.anchor?.node.contains(target), options.stopOutsideClickPropagation ?? true),
        ];
    };
});
const focusOnShowMixin = createMixin((handle) => {
    handle.addEventListener('insert', (event) => {
        let context = handle.context.get(PopoverProvider);
        context.showFocusTarget = event.node;
    });
});
const focusOnHideMixin = createMixin((handle) => {
    handle.addEventListener('insert', (event) => {
        let context = handle.context.get(PopoverProvider);
        context.hideFocusTarget = event.node;
    });
});
export const Context = PopoverProvider;
export const anchor = anchorMixin;
export const surface = surfaceMixin;
export const focusOnHide = focusOnHideMixin;
export const focusOnShow = focusOnShowMixin;
//# sourceMappingURL=popover.js.map