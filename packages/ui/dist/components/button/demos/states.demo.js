import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import * as button from '@remix-run/ui/button';
import { css } from '@remix-run/ui';
import { Glyph } from '@remix-run/ui/glyph';
import { theme } from '@remix-run/ui/theme';
/**
 * @name Button States
 * @description Buttons support normal, disabled, and busy (loading) states using aria attributes.
 * @layout center
 * @order 3
 */
export default function Example() {
    return () => (_jsxs("div", { mix: buttonRowCss, children: [_jsxs("button", { mix: [button.baseStyle, button.primaryStyle], children: [_jsx(Glyph, { mix: button.iconStyle, name: "add" }), _jsx("span", { mix: button.labelStyle, children: "New issue" })] }), _jsxs("button", { mix: [button.baseStyle, button.ghostStyle], children: [_jsx("span", { mix: button.labelStyle, children: "Open" }), _jsx(Glyph, { mix: button.iconStyle, name: "chevronRight" })] }), _jsx("button", { disabled: true, mix: [button.baseStyle, button.secondaryStyle], children: _jsx("span", { mix: button.labelStyle, children: "Disabled" }) }), _jsxs("button", { "aria-busy": "true", mix: [button.baseStyle, button.secondaryStyle], children: [_jsx(Glyph, { mix: [button.iconStyle, spinnerGlyphCss, spinCss], name: "spinner" }), _jsx("span", { mix: button.labelStyle, children: "Saving" })] })] }));
}
const buttonRowCss = css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.space.sm,
});
const spinnerGlyphCss = css({
    opacity: 0.72,
});
const spinCss = css({
    '@keyframes demo-button-spin': {
        from: { transform: 'rotate(0deg)' },
        to: { transform: 'rotate(360deg)' },
    },
    animation: 'demo-button-spin 1s linear infinite',
});
//# sourceMappingURL=states.demo.js.map