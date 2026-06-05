import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { css } from '@remix-run/ui';
import * as button from '@remix-run/ui/button';
import { Glyph } from '@remix-run/ui/glyph';
import * as listbox from '@remix-run/ui/listbox';
import * as popover from '@remix-run/ui/popover';
import * as select from '@remix-run/ui/select';
import { theme } from '@remix-run/ui/theme';
/**
 * @name Select Deconstructed
 * @description Build a fully custom select by composing the select, popover, and listbox primitives directly.
 * @layout center
 */
export default function Example(handle) {
    let label = 'Local';
    let value = 'local';
    let triggerId = `${handle.id}-trigger`;
    return () => (_jsxs("div", { mix: [
            stackCss,
            select.onSelectChange((event) => {
                label = event.label ?? 'Select an environment';
                value = event.value ?? 'null';
                void handle.update();
            }),
        ], children: [_jsx("p", { mix: labelCss, children: "Environment" }), _jsxs(select.Context, { defaultLabel: "Local", defaultValue: "local", name: "environment", children: [_jsxs("button", { id: triggerId, type: "button", mix: [button.baseStyle, select.triggerStyle, select.trigger(), selectCss], children: [_jsx("span", { mix: button.labelStyle, children: label }), _jsx(Glyph, { mix: button.iconStyle, name: "chevronVertical" })] }), _jsx(popover.Context, { children: _jsx("div", { mix: [popover.surfaceStyle, select.popover()], children: _jsx("div", { "aria-labelledby": triggerId, mix: [popover.contentStyle, listbox.listStyle, select.list()], children: environmentOptions.map((option) => (_jsxs("div", { mix: [listbox.optionStyle, select.option(option)], children: [_jsx(Glyph, { mix: listbox.glyphStyle, name: "check" }), _jsx("span", { mix: listbox.labelStyle, children: option.label })] }, option.value))) }) }) }), _jsx("input", { mix: select.hiddenInput() })] }), _jsx("p", { mix: valueCss, children: `value=${value}` })] }));
}
const environmentOptions = [
    { label: 'Local', value: 'local' },
    { label: 'Staging', value: 'staging' },
    { label: 'Production', value: 'production' },
    { disabled: true, label: 'Archived', value: 'archived' },
];
const selectCss = css({
    width: '16rem',
});
const stackCss = css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.space.sm,
    width: '100%',
});
const labelCss = css({
    margin: 0,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text.primary,
});
const valueCss = css({
    margin: 0,
    fontFamily: theme.fontFamily.mono,
    fontSize: theme.fontSize.xs,
    color: theme.colors.text.secondary,
});
//# sourceMappingURL=deconstructed.demo.js.map