import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { css } from '@remix-run/ui';
import * as button from '@remix-run/ui/button';
import { Glyph } from '@remix-run/ui/glyph';
import { theme } from '@remix-run/ui/theme';
/**
 * @name Basic Button
 * @description The default button contract supports both ordinary actions and link-shaped navigation.
 * @layout center
 * @order 1
 */
export default function Example() {
    return () => (_jsxs("div", { mix: buttonRowCss, children: [_jsxs("button", { type: "submit", mix: [button.baseStyle, button.primaryStyle], children: [_jsx(Glyph, { mix: button.iconStyle, name: "add" }), _jsx("span", { mix: button.labelStyle, children: "Publish" })] }), _jsxs("a", { href: "/api/remix/ui/button/overview/", mix: [button.baseStyle, button.secondaryStyle], children: [_jsx("span", { mix: button.labelStyle, children: "View button docs" }), _jsx(Glyph, { mix: button.iconStyle, name: "chevronRight" })] })] }));
}
const buttonRowCss = css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.space.sm,
});
//# sourceMappingURL=basic.demo.js.map