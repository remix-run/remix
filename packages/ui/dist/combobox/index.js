import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { createElement, css } from '@remix-run/ui';
import * as combobox from '@remix-run/ui/combobox/primitives';
import { CheckIcon } from "../shared/icons.js";
import { listboxIndicatorStyle, listboxLabelStyle, listboxListStyle, listboxOptionStyle, popoverSurfaceStyle, } from "../shared/listbox-popover-styles.js";
import { componentStyleValues as styles } from "../shared/style-values.js";
const comboboxPopoverCss = css({
    opacity: 0,
    '&:popover-open': {
        opacity: 1,
    },
    '&:not(:popover-open)': {
        pointerEvents: 'none',
    },
    '&[data-show-reason="nav"]:not(:popover-open)': {
        transition: 'opacity 180ms ease-in, overlay 180ms ease-in, display 180ms ease-in',
        transitionBehavior: 'allow-discrete',
    },
    '&[data-show-reason="hint"]:not(:popover-open)': {
        transition: 'none',
        transitionBehavior: 'normal',
    },
});
const comboboxInputCss = css({
    minHeight: styles.control.height.sm,
    width: '100%',
    paddingInline: styles.space.sm,
    border: `0.5px solid ${styles.colors.border.default}`,
    borderRadius: styles.radius.md,
    backgroundColor: styles.surface.lvl0,
    color: styles.colors.text.primary,
    fontFamily: styles.fontFamily.sans,
    fontSize: styles.fontSize.sm,
    lineHeight: styles.lineHeight.normal,
    boxShadow: 'inset 0 1px 0 light-dark(rgb(255 255 255 / 0.7), rgb(255 255 255 / 0.08))',
    '&:focus-visible': {
        outline: `2px solid ${styles.colors.focus.ring}`,
        outlineOffset: styles.space.none,
    },
    '&[data-surface-visible="true"][aria-activedescendant]:focus-visible': {
        outline: 'none',
    },
});
export const inputStyle = comboboxInputCss;
export const popoverStyle = comboboxPopoverCss;
export function Combobox(handle) {
    return () => {
        let { children, defaultValue, disabled, inputId, name, placeholder, ...divProps } = handle.props;
        return (_jsx(combobox.Context, { defaultValue: defaultValue, disabled: disabled, name: name, children: _jsxs("div", { ...divProps, children: [_jsx("input", { defaultValue: defaultValue ?? undefined, id: inputId, mix: [inputStyle, combobox.input()], placeholder: placeholder }), _jsx("div", { mix: [popoverSurfaceStyle, popoverStyle, combobox.popover()], children: _jsx("div", { mix: [listboxListStyle, combobox.list()], children: children }) }), name && _jsx("input", { mix: combobox.hiddenInput() })] }) }));
    };
}
export function ComboboxOption(handle) {
    return () => {
        let { children, disabled, label, mix, searchValue, value, ...divProps } = handle.props;
        return (_jsxs("div", { ...divProps, mix: [listboxOptionStyle, combobox.option({ disabled, label, searchValue, value }), mix], children: [_jsx(CheckIcon, { mix: listboxIndicatorStyle }), _jsx("span", { mix: listboxLabelStyle, children: children ?? label })] }));
    };
}
//# sourceMappingURL=index.js.map