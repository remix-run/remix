import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { css } from '@remix-run/ui';
import * as menu from '@remix-run/ui/menu';
import { MenuItem, MenuList, onMenuSelect, Submenu } from '@remix-run/ui/menu';
import { separatorStyle } from '@remix-run/ui/separator';
import { theme } from '@remix-run/ui/theme';
const actionLabelByName = {
    copyPath: 'Copied path',
    duplicate: 'Duplicated file',
    move: 'Moved file',
    rename: 'Renamed file',
    reveal: 'Revealed in Finder',
    trash: 'Moved to trash',
};
/**
 * @name Context Menu Trigger
 * @description A lower-level menu composition that opens from right-click coordinates while keeping standard menu selection and submenu behavior.
 * @layout center
 */
export default function Example(handle) {
    let latestAction = 'Right-click the card.';
    return () => (_jsxs(menu.Context, { label: "File actions", children: [_jsxs("div", { mix: layoutCss, children: [_jsxs("div", { tabIndex: 0, mix: [fileCardCss, menu.contextTrigger()], children: [_jsx("span", { mix: fileIconCss, children: "TS" }), _jsxs("span", { mix: fileTextCss, children: [_jsx("strong", { mix: fileNameCss, children: "context-menu.tsx" }), _jsx("span", { mix: fileMetaCss, children: "Right-click or press Shift+F10" })] })] }), _jsx("p", { "aria-live": "polite", mix: statusCss, children: latestAction })] }), _jsxs(MenuList, { mix: onMenuSelect((event) => {
                    latestAction =
                        actionLabelByName[event.item.name] ?? `Selected ${event.item.label}`;
                    void handle.update();
                }), children: [_jsx(MenuItem, { name: "rename", children: "Rename" }), _jsx(MenuItem, { name: "duplicate", children: "Duplicate" }), _jsx(MenuItem, { name: "copyPath", children: "Copy path" }), _jsx("hr", { mix: separatorStyle }), _jsxs(Submenu, { label: "Move to", children: [_jsx(MenuItem, { name: "move", value: "drafts", children: "Drafts" }), _jsx(MenuItem, { name: "move", value: "archive", children: "Archive" })] }), _jsx(MenuItem, { name: "reveal", children: "Reveal in Finder" }), _jsx("hr", { mix: separatorStyle }), _jsx(MenuItem, { name: "trash", children: "Move to trash" })] })] }));
}
const layoutCss = css({
    display: 'grid',
    justifyItems: 'start',
    gap: theme.space.md,
});
const fileCardCss = css({
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr)',
    alignItems: 'center',
    gap: theme.space.md,
    width: 'min(100%, 21rem)',
    padding: theme.space.md,
    border: `1px solid ${theme.colors.border.subtle}`,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surface.lvl1,
    color: theme.colors.text.primary,
    boxShadow: theme.shadow.xs,
    cursor: 'context-menu',
    userSelect: 'none',
    '&:focus-visible': {
        outline: `2px solid ${theme.colors.focus.ring}`,
        outlineOffset: '2px',
    },
});
const fileIconCss = css({
    display: 'inline-grid',
    placeItems: 'center',
    width: theme.control.height.lg,
    height: theme.control.height.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.action.primary.background,
    color: theme.colors.action.primary.foreground,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.bold,
});
const fileTextCss = css({
    display: 'grid',
    gap: theme.space.px,
    minWidth: 0,
});
const fileNameCss = css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: theme.fontSize.sm,
    lineHeight: theme.lineHeight.normal,
});
const fileMetaCss = css({
    color: theme.colors.text.secondary,
    fontSize: theme.fontSize.xs,
    lineHeight: theme.lineHeight.normal,
});
const statusCss = css({
    margin: 0,
    minHeight: theme.lineHeight.normal,
    color: theme.colors.text.secondary,
    fontSize: theme.fontSize.sm,
    lineHeight: theme.lineHeight.normal,
});
//# sourceMappingURL=context-trigger.demo.js.map