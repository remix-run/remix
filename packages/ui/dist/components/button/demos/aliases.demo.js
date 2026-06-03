import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { Button } from '@remix-run/ui/button';
import { css } from '@remix-run/ui';
import { theme } from '@remix-run/ui/theme';
/**
 * @name Button Component
 * @description The Button component wraps the low-level style primitives and accepts a tone prop for quick theming.
 * @layout center
 * @order 2
 */
export default function Example() {
    return () => (_jsxs("div", { mix: buttonRowCss, children: [_jsx(Button, { tone: "primary", type: "submit", children: "Save" }), _jsx(Button, { tone: "secondary", children: "Secondary" }), _jsx(Button, { tone: "ghost", children: "Ghost" }), _jsx(Button, { tone: "danger", children: "Delete" })] }));
}
const buttonRowCss = css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.space.sm,
});
//# sourceMappingURL=aliases.demo.js.map