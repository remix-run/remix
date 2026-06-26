import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { createElement, css } from '@remix-run/ui';
import * as popover from '@remix-run/ui/popover';
import * as select from '@remix-run/ui/select';
import * as button from "../button/button.js";
import { CheckIcon, ChevronVerticalIcon } from "../shared/icons.js";
import { listboxIndicatorStyle, listboxLabelStyle, listboxListStyle, listboxOptionStyle, popoverSurfaceStyle, } from "../shared/listbox-popover-styles.js";
import { componentStyleValues as styles } from "../shared/style-values.js";
const selectTriggerCss = css({
    minHeight: styles.control.height.sm,
    width: '100%',
    paddingInline: styles.space.md,
    paddingInlineEnd: styles.space.sm,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: styles.space.sm,
    borderRadius: styles.radius.md,
    backgroundImage: 'none',
    border: '0.5px solid transparent',
    boxShadow: 'none',
    fontSize: styles.fontSize.xs,
    textAlign: 'left',
    backgroundColor: styles.surface.lvl3,
    color: styles.colors.text.secondary,
    '&:hover, &:focus-visible, &[aria-expanded="true"], &[aria-expanded="true"]:hover, &[aria-expanded="true"]:focus-visible': {
        backgroundColor: styles.surface.lvl4,
        color: styles.colors.text.primary,
    },
    '&:active': {
        backgroundColor: styles.surface.lvl3,
    },
    '&:focus-visible': {
        outline: `2px solid ${styles.colors.focus.ring}`,
        outlineOffset: '2px',
    },
    '&:disabled': {
        opacity: 0.6,
    },
});
export const triggerStyle = selectTriggerCss;
function SelectLabel(handle) {
    let context = handle.context.get(select.Context);
    return () => _jsx("span", { mix: button.labelStyle, children: context.displayedLabel });
}
export function Select(handle) {
    return () => {
        let { children, defaultLabel, defaultValue, disabled, name, mix, ...buttonProps } = handle.props;
        return (_jsxs(select.Context, { defaultLabel: defaultLabel, defaultValue: defaultValue, disabled: disabled, name: name, children: [_jsxs("button", { ...buttonProps, mix: [button.baseStyle, triggerStyle, select.trigger(), mix], children: [_jsx(SelectLabel, {}), _jsx(ChevronVerticalIcon, { mix: button.iconStyle })] }), _jsx(popover.Context, { children: _jsx("div", { mix: [popoverSurfaceStyle, select.popover()], children: _jsx("div", { mix: [listboxListStyle, select.list()], children: children }) }) }), name && _jsx("input", { mix: select.hiddenInput() })] }));
    };
}
export function Option(handle) {
    return () => {
        let { label, value, disabled, textValue, children, mix, ...divProps } = handle.props;
        return (_jsxs("div", { ...divProps, mix: [listboxOptionStyle, select.option({ value, label, disabled, textValue }), mix], children: [_jsx(CheckIcon, { mix: listboxIndicatorStyle }), _jsx("span", { mix: listboxLabelStyle, children: children ?? label })] }));
    };
}
//# sourceMappingURL=select.js.map