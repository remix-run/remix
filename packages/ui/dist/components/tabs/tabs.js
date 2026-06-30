import { jsx as _jsx } from "@remix-run/ui/jsx-runtime";
import { createElement, css } from '@remix-run/ui';
import * as tabs from '@remix-run/ui/tabs';
import * as button from "../button/button.js";
import { componentStyleValues as styles } from "../shared/style-values.js";
const tabsListCss = css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: styles.space.xs,
    minWidth: 0,
    padding: styles.space.xs,
    border: `1px solid ${styles.colors.border.subtle}`,
    borderRadius: styles.radius.xl,
    backgroundColor: styles.surface.lvl2,
});
const tabsTriggerCss = css({
    justifyContent: 'flex-start',
    minHeight: styles.control.height.md,
    paddingInline: styles.space.md,
    border: '1px solid transparent',
    borderRadius: styles.radius.md,
    backgroundColor: 'transparent',
    color: styles.colors.text.secondary,
    fontSize: styles.fontSize.md,
    '&:hover:not(:disabled):not([aria-disabled="true"])': {
        color: styles.colors.text.primary,
    },
    '&:focus-visible': {
        outline: `2px solid ${styles.colors.focus.ring}`,
        outlineOffset: '2px',
        color: styles.colors.text.primary,
    },
    '&[aria-selected="true"], &[aria-selected="true"]:hover, &[aria-selected="true"]:focus-visible': {
        backgroundColor: styles.surface.lvl0,
        borderColor: styles.colors.border.subtle,
        boxShadow: styles.shadow.xs,
        color: styles.colors.text.primary,
    },
    '&:disabled, &[aria-disabled="true"]': {
        opacity: 0.55,
    },
});
export const listStyle = tabsListCss;
export const triggerStyle = tabsTriggerCss;
export function Tabs(handle) {
    return () => {
        let { children, ...contextProps } = handle.props;
        return _jsx(tabs.Context, { ...contextProps, children: children });
    };
}
export function TabsList(handle) {
    return () => {
        let { children, mix, ...divProps } = handle.props;
        return (_jsx("div", { ...divProps, mix: [listStyle, tabs.list(), mix], children: children }));
    };
}
export function Tab(handle) {
    return () => {
        let { children, disabled, mix, type, value, ...buttonProps } = handle.props;
        return (_jsx("button", { ...buttonProps, disabled: disabled ? true : undefined, mix: [button.baseStyle, triggerStyle, tabs.trigger({ disabled, value }), mix], type: type ?? 'button', children: children }));
    };
}
export function TabsPanel(handle) {
    return () => {
        let { children, mix, value, ...divProps } = handle.props;
        return (_jsx("div", { ...divProps, mix: [tabs.panel({ value }), mix], children: children }));
    };
}
//# sourceMappingURL=tabs.js.map