import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { createElement, css } from '@remix-run/ui';
import * as popover from '@remix-run/ui/popover';
import * as select from '@remix-run/ui/select/primitives';
import { CheckIcon, ChevronVerticalIcon } from "../shared/icons.js";
import { listboxIndicatorStyle, listboxLabelStyle, listboxListStyle, listboxOptionStyle, popoverSurfaceStyle, } from "../shared/listbox-popover-styles.js";
const selectTriggerShadow = '0 2px 3px -1px rgba(0, 0, 0, 0.04), 0 3px 4px -1.5px rgba(0, 0, 0, 0.04), 0 4px 5px -2px rgba(0, 0, 0, 0.04), 0 0 0 1px light-dark(rgba(0, 0, 0, 0.12), rgba(255, 255, 255, 0.2))';
const selectTriggerFocusShadow = '0 2px 3px -1px rgba(0, 0, 0, 0.04), 0 3px 4px -1.5px rgba(0, 0, 0, 0.04), 0 4px 5px -2px rgba(0, 0, 0, 0.04), 0 0 0 1px light-dark(#3573F6, #6eaaff), 0 0 0 4px light-dark(rgba(53, 115, 246, 0.1), rgba(110, 170, 255, 0.18)), 0 6px 32px 4px light-dark(rgba(53, 115, 246, 0.08), rgba(110, 170, 255, 0.14)), inset 0 0 8px 1px light-dark(rgba(53, 115, 246, 0.05), rgba(110, 170, 255, 0.1))';
const selectTriggerCss = css({
    appearance: 'none',
    margin: 0,
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 0,
    height: '32px',
    paddingBlock: '6px',
    paddingInlineStart: '12px',
    paddingInlineEnd: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '6px',
    border: 0,
    borderRadius: '8px',
    background: 'light-dark(#FFFFFF, #1a1a1a)',
    boxShadow: selectTriggerShadow,
    color: 'light-dark(#101010, #ececec)',
    fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
    fontStyle: 'normal',
    fontWeight: 400,
    fontSize: '13px',
    lineHeight: '20px',
    fontFeatureSettings: '"ss01" on, "cv01" on',
    letterSpacing: 0,
    textAlign: 'left',
    textShadow: '0 1px 0 light-dark(#FFFFFF, rgb(0 0 0 / 0.35))',
    whiteSpace: 'nowrap',
    '&:hover, &:focus-visible, &[aria-expanded="true"], &[aria-expanded="true"]:hover, &[aria-expanded="true"]:focus-visible': {
        background: 'light-dark(#FFFFFF, #1a1a1a)',
        color: 'light-dark(#101010, #ececec)',
    },
    '&:active': {
        background: 'light-dark(#FFFFFF, #1a1a1a)',
    },
    '&:focus-visible': {
        outline: 0,
        boxShadow: selectTriggerFocusShadow,
    },
    '&[aria-expanded="true"]': {
        boxShadow: selectTriggerFocusShadow,
    },
    '&:disabled': {
        opacity: 0.55,
    },
});
const triggerLabelCss = css({
    display: 'inline-flex',
    alignItems: 'center',
    flex: '1 1 auto',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
});
const triggerIconCss = css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    color: 'light-dark(#707070, #b3b3b3)',
    flex: 'none',
    '& > svg': {
        display: 'block',
        width: '100%',
        height: '100%',
    },
});
export const triggerStyle = selectTriggerCss;
function SelectLabel(handle) {
    let context = handle.context.get(select.Context);
    return () => _jsx("span", { mix: triggerLabelCss, children: context.displayedLabel });
}
export function Select(handle) {
    return () => {
        let { children, defaultLabel, defaultValue, disabled, name, mix, ...buttonProps } = handle.props;
        return (_jsxs(select.Context, { defaultLabel: defaultLabel, defaultValue: defaultValue, disabled: disabled, name: name, children: [_jsxs("button", { type: "button", ...buttonProps, mix: [triggerStyle, select.trigger(), mix], children: [_jsx(SelectLabel, {}), _jsx(ChevronVerticalIcon, { mix: triggerIconCss })] }), _jsx(popover.Context, { children: _jsx("div", { mix: [popoverSurfaceStyle, select.popover()], children: _jsx("div", { mix: [listboxListStyle, select.list()], children: children }) }) }), name && _jsx("input", { mix: select.hiddenInput() })] }));
    };
}
export function Option(handle) {
    return () => {
        let { label, value, disabled, textValue, children, mix, ...divProps } = handle.props;
        return (_jsxs("div", { ...divProps, mix: [listboxOptionStyle, select.option({ value, label, disabled, textValue }), mix], children: [_jsx(CheckIcon, { mix: listboxIndicatorStyle }), _jsx("span", { mix: listboxLabelStyle, children: children ?? label })] }));
    };
}
//# sourceMappingURL=index.js.map