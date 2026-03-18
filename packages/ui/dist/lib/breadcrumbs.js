import { jsx as _jsx } from "@remix-run/component/jsx-runtime";
import { css } from '@remix-run/component';
import { Glyph } from "./glyph.js";
import { theme } from "./theme.js";
let rootCss = css({
    minWidth: 0,
});
let listCss = css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: `${theme.space.xs} ${theme.space.sm}`,
    minWidth: 0,
    margin: 0,
    padding: 0,
    listStyle: 'none',
});
let itemCss = css({
    display: 'inline-flex',
    alignItems: 'center',
    minWidth: 0,
});
let separatorCss = css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: theme.fontSize.sm,
    height: theme.fontSize.sm,
    color: theme.colors.text.muted,
});
let linkCss = css({
    color: theme.colors.text.secondary,
    fontSize: theme.fontSize.sm,
    lineHeight: theme.lineHeight.normal,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    '&:hover': {
        color: theme.colors.text.primary,
    },
});
let currentCss = css({
    color: theme.colors.text.primary,
    fontSize: theme.fontSize.sm,
    lineHeight: theme.lineHeight.normal,
    fontWeight: theme.fontWeight.medium,
    whiteSpace: 'nowrap',
});
let textCss = css({
    color: theme.colors.text.secondary,
    fontSize: theme.fontSize.sm,
    lineHeight: theme.lineHeight.normal,
    whiteSpace: 'nowrap',
});
export function Breadcrumbs() {
    return ({ 'aria-label': ariaLabel, items, separator, mix, ...navProps }) => {
        let currentIndex = items.findIndex((item) => item.current);
        if (currentIndex === -1) {
            currentIndex = Math.max(0, items.length - 1);
        }
        let separatorContent = separator ?? _jsx(Glyph, { name: "chevronRight" });
        return (_jsx("nav", { "aria-label": ariaLabel ?? 'Breadcrumb', ...navProps, mix: [rootCss, ...(mix ?? [])], children: _jsx("ol", { mix: listCss, children: items.flatMap((item, index) => {
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