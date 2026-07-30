import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { createElement, css, ref } from '@remix-run/ui';
import button from '@remix-run/ui/button';
import * as menu from '@remix-run/ui/menu/primitives';
import { CheckIcon, ChevronDownIcon, ChevronRightIcon } from "../shared/icons.js";
import { popoverSurfaceStyle } from "../shared/listbox-popover-styles.js";
import { componentStyleValues as styles } from "../shared/style-values.js";
const menuButtonCss = css({
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    borderRadius: styles.radius.md,
    paddingInlineEnd: styles.space.sm,
    textAlign: 'left',
    '&[aria-expanded="true"], &[aria-expanded="true"]:hover, &[aria-expanded="true"]:focus-visible': {
        backgroundColor: styles.surface.lvl3,
        color: styles.colors.text.primary,
    },
});
const menuButtonLabelCss = css({
    display: 'inline-flex',
    alignItems: 'center',
    minWidth: 0,
});
const menuButtonIconCss = css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: styles.fontSize.md,
    height: styles.fontSize.md,
    color: 'currentColor',
    flexShrink: 0,
    '& > svg': {
        display: 'block',
        width: '100%',
        height: '100%',
    },
});
const menuPopoverCss = css({
    '&[data-menu-submenu="true"][data-anchor-placement^="right"]': {
        marginLeft: `calc(${styles.space.xs} * -1)`,
    },
    '&[data-menu-submenu="true"][data-anchor-placement^="left"]': {
        marginLeft: styles.space.xs,
    },
    '&[data-close-animation="none"]:not(:popover-open)': {
        transition: 'none',
        transitionBehavior: 'normal',
    },
});
const menuListCss = css({
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 auto',
    minHeight: 0,
    paddingBlock: styles.space.xs,
    paddingInline: styles.space.none,
    overflow: 'auto',
    overscrollBehavior: 'contain',
    outline: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    '--rmx-ui-item-inset': `calc(${styles.space.sm} + ${styles.space.xs})`,
    '--rmx-ui-item-indicator-gap': 'var(--rmx-menu-item-slot-gap)',
    '--rmx-ui-item-indicator-width': 'var(--rmx-menu-item-slot-width)',
    '--rmx-menu-item-slot-gap': styles.space.none,
    '--rmx-menu-item-slot-width': styles.space.none,
    '&:has(> [role="menuitemcheckbox"])': {
        '--rmx-menu-item-slot-gap': styles.space.xs,
        '--rmx-menu-item-slot-width': styles.fontSize.md,
    },
    '&:has(> [role="menuitemradio"])': {
        '--rmx-menu-item-slot-gap': styles.space.xs,
        '--rmx-menu-item-slot-width': styles.fontSize.md,
    },
});
const menuItemCss = css({
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    minWidth: 0,
    minHeight: styles.control.height.md,
    boxSizing: 'border-box',
    position: 'relative',
    isolation: 'isolate',
    paddingInline: `calc(${styles.space.sm} + ${styles.space.xs})`,
    color: styles.colors.text.primary,
    fontFamily: styles.fontFamily.sans,
    fontSize: styles.fontSize.sm,
    fontWeight: styles.fontWeight.normal,
    lineHeight: styles.lineHeight.normal,
    textAlign: 'left',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    '--rmx-menu-item-indicator-opacity': '0',
    '&::before': {
        content: '""',
        position: 'absolute',
        insetBlock: 0,
        insetInline: styles.space.xs,
        borderRadius: styles.radius.md,
        backgroundColor: 'transparent',
        pointerEvents: 'none',
        zIndex: -1,
    },
    '&:focus': {
        outline: 'none',
    },
    '&[data-highlighted="true"]': {
        color: styles.colors.action.primary.foreground,
    },
    '&[data-highlighted="true"]::before': {
        backgroundColor: styles.colors.action.primary.background,
    },
    '&[aria-haspopup="menu"][aria-expanded="true"]:not(:focus)': {
        color: styles.colors.text.primary,
    },
    '&[aria-haspopup="menu"][aria-expanded="true"]:not(:focus)::before': {
        backgroundColor: styles.surface.lvl2,
    },
    '&[data-submenu-state="selecting"], &[data-submenu-state="dismissing"]': {
        color: styles.colors.text.primary,
    },
    '&[data-submenu-state="selecting"]::before, &[data-submenu-state="dismissing"]::before': {
        backgroundColor: styles.surface.lvl2,
    },
    '&[data-menu-flash="true"]': {
        color: styles.colors.text.primary,
    },
    '&[data-menu-flash="true"]::before': {
        backgroundColor: 'transparent',
    },
    '&[aria-disabled="true"]': {
        opacity: 0.5,
    },
    '&[aria-checked="true"], &[aria-selected="true"]': {
        '--rmx-menu-item-indicator-opacity': '1',
    },
});
const menuItemSlotCss = css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 var(--rmx-menu-item-slot-width)',
    width: 'var(--rmx-menu-item-slot-width)',
    minWidth: 0,
    marginInlineEnd: 'var(--rmx-menu-item-slot-gap)',
    overflow: 'hidden',
});
const menuItemLabelCss = css({
    display: 'inline-flex',
    alignItems: 'center',
    flex: '1 1 auto',
    minWidth: 0,
});
const menuItemIndicatorCss = css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: styles.fontSize.md,
    height: styles.fontSize.md,
    color: 'currentColor',
    flexShrink: 0,
    '& > svg': {
        display: 'block',
        width: '100%',
        height: '100%',
    },
    opacity: 'var(--rmx-menu-item-indicator-opacity)',
});
const menuTriggerIndicatorCss = css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: styles.fontSize.md,
    height: styles.fontSize.md,
    color: 'currentColor',
    flexShrink: 0,
    marginInlineStart: 'auto',
    '& > svg': {
        display: 'block',
        width: '100%',
        height: '100%',
    },
});
export const buttonStyle = menuButtonCss;
export const popoverStyle = menuPopoverCss;
export const listStyle = menuListCss;
export const itemStyle = menuItemCss;
export const itemSlotStyle = menuItemSlotCss;
export const itemLabelStyle = menuItemLabelCss;
export const itemIndicatorStyle = menuItemIndicatorCss;
export const triggerIndicatorStyle = menuTriggerIndicatorCss;
export function Menu(handle) {
    let buttonRef;
    return () => {
        let { children, label, menuLabel, mix, type, ...buttonProps } = handle.props;
        return (_jsxs(menu.Context, { label: menuLabel, children: [_jsxs("button", { ...buttonProps, type: type ?? 'button', mix: [
                        button(),
                        buttonStyle,
                        menu.trigger(),
                        ref((node, signal) => {
                            buttonRef = node;
                            signal.addEventListener('abort', () => {
                                if (buttonRef === node) {
                                    buttonRef = undefined;
                                }
                            });
                        }),
                        mix,
                    ], children: [_jsx("span", { mix: menuButtonLabelCss, children: label }), _jsx(ChevronDownIcon, { mix: menuButtonIconCss })] }), _jsx(MenuList, { mix: menu.onMenuSelect((event) => {
                        if (!buttonRef) {
                            return;
                        }
                        event.stopPropagation();
                        buttonRef.dispatchEvent(new menu.MenuSelectEvent(event.item));
                    }), children: children })] }));
    };
}
export function MenuList(handle) {
    return () => {
        let { children, mix, ...divProps } = handle.props;
        return (_jsx("div", { mix: [popoverSurfaceStyle, popoverStyle, menu.popover()], children: _jsx("div", { ...divProps, mix: [listStyle, menu.list(), mix], children: children }) }));
    };
}
export function MenuItem(handle) {
    return () => {
        let { checked, children, disabled, label, mix, name, searchValue, type, value, ...divProps } = handle.props;
        return (_jsxs("div", { ...divProps, mix: [
                itemStyle,
                menu.item({ checked, disabled, label, name, searchValue, type, value }),
                mix,
            ], children: [_jsx("span", { mix: itemSlotStyle, children: _jsx(CheckIcon, { mix: itemIndicatorStyle }) }), _jsx("span", { mix: itemLabelStyle, children: children ?? label })] }));
    };
}
export function Submenu(handle) {
    return () => {
        let { children, disabled, label, listProps, menuLabel, mix, searchValue, value, ...divProps } = handle.props;
        return (_jsxs(menu.Context, { label: menuLabel, children: [_jsxs("div", { ...divProps, mix: [
                        itemStyle,
                        menu.submenuTrigger({
                            disabled,
                            searchValue,
                            value,
                        }),
                        mix,
                    ], children: [_jsx("span", { mix: itemSlotStyle, children: _jsx(CheckIcon, { mix: itemIndicatorStyle }) }), _jsx("span", { mix: itemLabelStyle, children: label }), _jsx(ChevronRightIcon, { mix: triggerIndicatorStyle })] }), _jsx(MenuList, { ...listProps, children: children })] }));
    };
}
//# sourceMappingURL=index.js.map