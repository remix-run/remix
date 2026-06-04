import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { css, on } from '@remix-run/ui';
import { Glyph } from '@remix-run/ui/glyph';
import * as listbox from '@remix-run/ui/listbox';
import { theme } from '@remix-run/ui/theme';
/**
 * @name Listbox Overview
 * @description A keyboard-navigable listbox with selection, highlighting, and an optional flash-selection animation.
 * @layout center
 */
export default function Example(handle) {
    let value = options[0].value;
    let activeValue = options[0].value;
    let flashSelection = false;
    return () => {
        return (_jsxs("div", { mix: stackCss, children: [_jsx(listbox.Context, { value: value, activeValue: activeValue, flashSelection: flashSelection, onSelect: (nextValue) => {
                        value = nextValue;
                        handle.update();
                    }, onHighlight: (nextActiveValue) => {
                        activeValue = nextActiveValue;
                        handle.update();
                    }, children: _jsx("div", { tabIndex: 0, mix: [listbox.listStyle, listbox.list(), containerCss], children: options.map((option) => (_jsxs("div", { mix: [listbox.optionStyle, listbox.option(option)], children: [_jsx(Glyph, { mix: listbox.glyphStyle, name: "check" }), _jsx("span", { mix: listbox.labelStyle, children: option.label })] }, option.value))) }) }), _jsxs("div", { mix: controlsCss, children: [_jsxs("label", { mix: checkboxLabelCss, children: [_jsx("input", { type: "checkbox", defaultChecked: flashSelection, mix: on('change', (event) => {
                                        flashSelection = event.currentTarget.checked;
                                        handle.update();
                                    }) }), ' ', "Flash selection"] }), _jsx("p", { mix: valueCss, children: `value=${value ?? 'null'}` })] })] }));
    };
}
const options = [
    { label: 'Apple', value: 'apple' },
    { label: 'Banana', value: 'banana' },
    { label: 'Cherry', value: 'cherry' },
    { label: 'Date', value: 'date' },
    { label: 'Elderberry', value: 'elderberry' },
    { label: 'Fig', value: 'fig' },
    { label: 'Grape', value: 'grape' },
];
const containerCss = css({
    borderColor: theme.colors.border.subtle,
    padding: theme.space.xs,
    borderRadius: theme.radius.lg,
    borderStyle: 'solid',
});
const stackCss = css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.space.md,
    width: '100%',
});
const controlsCss = css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.space.xs,
});
const checkboxLabelCss = css({
    fontSize: theme.fontSize.sm,
    lineHeight: theme.lineHeight.normal,
    color: theme.colors.text.secondary,
});
const valueCss = css({
    margin: 0,
    fontFamily: theme.fontFamily.mono,
    fontSize: theme.fontSize.xs,
    color: theme.colors.text.secondary,
});
//# sourceMappingURL=overview.demo.js.map