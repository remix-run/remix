import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { css } from '@remix-run/ui';
import { Option, Select } from '@remix-run/ui/select';
import { theme } from '@remix-run/ui/theme';
/**
 * @name Select Overview
 * @description A styled select control with a searchable dropdown and accessible label.
 * @layout center
 */
export default function Example() {
    return () => (_jsxs("div", { mix: stackCss, children: [_jsx("label", { for: "fruit-select", mix: labelCss, children: "Choose a fruit" }), _jsxs(Select, { id: "fruit-select", defaultLabel: "Banana", defaultValue: "banana", name: "fruit", mix: selectCss, children: [_jsx(Option, { label: "Apple", value: "apple" }), _jsx(Option, { label: "Apricot", value: "apricot" }), _jsx(Option, { label: "Banana", value: "banana" }), _jsx(Option, { label: "Blackberry", value: "blackberry" }), _jsx(Option, { label: "Blackcurrant", value: "blackcurrant" }), _jsx(Option, { label: "Blueberry", value: "blueberry" }), _jsx(Option, { label: "Boysenberry", value: "boysenberry" }), _jsx(Option, { label: "Cantaloupe", value: "cantaloupe" })] })] }));
}
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
//# sourceMappingURL=overview.demo.js.map