import { jsx as _jsx } from "@remix-run/ui/jsx-runtime";
// @jsxRuntime classic
// @jsx createElement
import { css, createElement } from '@remix-run/ui';
import { Glyph } from "../glyph/glyph.js";
import { theme } from "../../theme/theme.js";
const rootCss = css({
    minWidth: 0,
});
const listCss = css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: `${theme.space.xs} ${theme.space.sm}`,
    minWidth: 0,
    margin: 0,
    padding: 0,
    listStyle: 'none',
});
const itemCss = css({
    display: 'inline-flex',
    alignItems: 'center',
    minWidth: 0,
});
const separatorCss = css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: theme.fontSize.sm,
    height: theme.fontSize.sm,
    color: theme.colors.text.muted,
});
const linkCss = css({
    color: theme.colors.text.secondary,
    fontSize: theme.fontSize.sm,
    lineHeight: theme.lineHeight.normal,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    '&:hover': {
        color: theme.colors.text.primary,
    },
});
const currentCss = css({
    color: theme.colors.text.primary,
    fontSize: theme.fontSize.sm,
    lineHeight: theme.lineHeight.normal,
    fontWeight: theme.fontWeight.medium,
    whiteSpace: 'nowrap',
});
const textCss = css({
    color: theme.colors.text.secondary,
    fontSize: theme.fontSize.sm,
    lineHeight: theme.lineHeight.normal,
    whiteSpace: 'nowrap',
});
export function Breadcrumbs(handle) {
    return () => {
        let { 'aria-label': ariaLabel, items, separator, mix, ...navProps } = handle.props;
        let currentIndex = items.findIndex((item) => item.current);
        if (currentIndex === -1) {
            currentIndex = Math.max(0, items.length - 1);
        }
        let separatorContent = separator ?? _jsx(Glyph, { name: "chevronRight" });
        return (_jsx("nav", { "aria-label": ariaLabel ?? 'Breadcrumb', ...navProps, mix: [rootCss, mix], children: _jsx("ol", { mix: listCss, children: items.flatMap((item, index) => {
                    let isCurrent = index === currentIndex;
                    let content = isCurrent ? (_jsx("span", { "aria-current": "page", mix: currentCss, children: item.label })) : item.href ? (_jsx("a", { href: item.href, mix: linkCss, children: item.label })) : (_jsx("span", { mix: textCss, children: item.label }));
                    let nodes = [
                        _jsx("li", { mix: itemCss, children: content }, `item-${index}`),
                    ];
                    if (index < items.length - 1) {
                        nodes.push(_jsx("li", { "aria-hidden": "true", mix: separatorCss, children: separatorContent }, `separator-${index}`));
                    }
                    return nodes;
                }) }) }));
    };
}
//# sourceMappingURL=breadcrumbs.js.map