import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { css, on } from '@remix-run/ui';
import { Button } from '@remix-run/ui/button';
import { Glyph } from '@remix-run/ui/glyph';
import * as popover from '@remix-run/ui/popover';
import { Option, Select } from '@remix-run/ui/select';
import { theme } from '@remix-run/ui/theme';
/**
 * @name Popover Overview
 * @description A popover panel anchored to a trigger button, containing form controls and a close action.
 */
export default function Example(handle) {
    let open = false;
    function closePopover() {
        open = false;
        void handle.update();
    }
    return () => (_jsxs(popover.Context, { children: [_jsx("div", { mix: buttonRowCss, children: _jsx(Button, { endIcon: _jsx(Glyph, { name: "chevronDown" }), mix: [
                        popover.anchor({ placement: 'bottom' }),
                        popover.focusOnHide(),
                        on('click', () => {
                            open = !open;
                            void handle.update();
                        }),
                    ], tone: "secondary", children: "View options" }) }), _jsx("div", { mix: [
                    popover.surfaceStyle,
                    popover.surface({
                        closeOnAnchorClick: false,
                        open,
                        onHide() {
                            closePopover();
                        },
                    }),
                ], children: _jsxs("div", { mix: [popover.contentStyle, panelCss], children: [_jsxs("div", { mix: fieldCss, children: [_jsx("label", { for: `${handle.id}-grouping`, mix: labelCss, children: "Grouping" }), _jsxs(Select, { id: `${handle.id}-grouping`, defaultLabel: "No grouping", defaultValue: "none", mix: [fieldSelectCss, popover.focusOnShow()], children: [_jsx(Option, { label: "No grouping", value: "none" }), _jsx(Option, { label: "Status", value: "status" }), _jsx(Option, { label: "Priority", value: "priority" })] })] }), _jsxs("div", { mix: fieldCss, children: [_jsx("label", { for: `${handle.id}-ordering`, mix: labelCss, children: "Ordering" }), _jsxs(Select, { id: `${handle.id}-ordering`, defaultLabel: "Manual", defaultValue: "manual", mix: fieldSelectCss, children: [_jsx(Option, { label: "Manual", value: "manual" }), _jsx(Option, { label: "Newest first", value: "newest" }), _jsx(Option, { label: "Oldest first", value: "oldest" })] })] }), _jsxs("div", { mix: fieldCss, children: [_jsx("label", { for: `${handle.id}-closed-projects`, mix: labelCss, children: "Show closed projects" }), _jsxs(Select, { id: `${handle.id}-closed-projects`, defaultLabel: "All", defaultValue: "all", mix: fieldSelectCss, children: [_jsx(Option, { label: "All", value: "all" }), _jsx(Option, { label: "Open only", value: "open" }), _jsx(Option, { label: "Closed only", value: "closed" })] })] }), _jsx("div", { mix: actionsCss, children: _jsx(Button, { mix: on('click', closePopover), tone: "ghost", children: "Done" }) })] }) })] }));
}
const buttonRowCss = css({
    display: 'flex',
    justifyContent: 'flex-start',
});
const panelCss = css({
    display: 'grid',
    gap: theme.space.md,
    width: '22rem',
    padding: theme.space.lg,
});
const fieldCss = css({
    display: 'grid',
    gap: theme.space.px,
});
const labelCss = css({
    margin: 0,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text.primary,
});
const fieldSelectCss = css({
    width: '100%',
});
const actionsCss = css({
    display: 'flex',
    justifyContent: 'flex-end',
    paddingTop: theme.space.xs,
});
//# sourceMappingURL=overview.demo.js.map