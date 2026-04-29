import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
// @jsxRuntime classic
// @jsx createElement
import { attrs, createElement, createMixin, css } from '@remix-run/ui';
import { theme } from "../../theme/theme.js";
const ghostButtonToneCss = css({
    backgroundColor: 'transparent',
    backgroundImage: 'none',
    color: theme.colors.text.secondary,
    border: '0.5px solid transparent',
    boxShadow: 'none',
    '&:hover': {
        backgroundColor: theme.surface.lvl3,
        color: theme.colors.text.primary,
    },
    '&:active': {
        backgroundColor: `color-mix(in oklab, ${theme.surface.lvl3} 94%, black)`,
        color: `color-mix(in oklab, ${theme.colors.text.primary} 94%, black)`,
    },
    '&:focus-visible': {
        outline: `2px solid ${theme.colors.focus.ring}`,
        outlineOffset: '2px',
        backgroundColor: theme.surface.lvl3,
        color: theme.colors.text.primary,
    },
    '&:disabled': {
        opacity: 0.6,
    },
});
const buttonBaseStyleCss = css({
    '--rmx-button-label-padding-inline': theme.space.xs,
    all: 'unset',
    boxSizing: 'border-box',
    cursor: 'revert',
    position: 'relative',
    isolation: 'isolate',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: theme.radius.full,
    fontFamily: theme.fontFamily.sans,
    minHeight: theme.control.height.sm,
    paddingInline: theme.space.md,
    fontSize: theme.fontSize.xs,
    lineHeight: '1',
    fontWeight: theme.fontWeight.medium,
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    verticalAlign: 'top',
});
const buttonLabelCss = css({
    display: 'inline-flex',
    alignItems: 'center',
    minWidth: 0,
    paddingInline: 'var(--rmx-button-label-padding-inline)',
});
const buttonIconCss = css({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '1em',
    height: '1em',
    flexShrink: 0,
    '& > svg': {
        display: 'block',
        width: '100%',
        height: '100%',
    },
});
const buttonIconAttrsCss = attrs({ 'aria-hidden': true });
const buttonDefaultsMixin = createMixin((handle, hostType) => (props) => {
    if (hostType !== 'button' || props.type !== undefined) {
        return handle.element;
    }
    return createElement(handle.element, {
        ...props,
        type: 'button',
    });
});
const buttonDefaultsCss = buttonDefaultsMixin();
export const baseStyle = [buttonDefaultsCss, buttonBaseStyleCss];
export const iconStyle = [buttonIconAttrsCss, buttonIconCss];
export const labelStyle = buttonLabelCss;
export const primaryStyle = createButtonCss(theme.colors.action.primary);
export const secondaryStyle = createButtonCss(theme.colors.action.secondary);
export const ghostStyle = ghostButtonToneCss;
export const dangerStyle = createButtonCss(theme.colors.action.danger);
const toneStyleByTone = {
    primary: primaryStyle,
    secondary: secondaryStyle,
    ghost: ghostStyle,
    danger: dangerStyle,
};
export function Button(handle) {
    return () => {
        let { children, endIcon, mix, startIcon, tone = 'secondary', ...buttonProps } = handle.props;
        return (_jsxs("button", { ...buttonProps, mix: [baseStyle, toneStyleByTone[tone], mix], children: [startIcon ? _jsx("span", { mix: iconStyle, children: startIcon }) : null, children !== undefined ? _jsx("span", { mix: labelStyle, children: children }) : null, endIcon ? _jsx("span", { mix: iconStyle, children: endIcon }) : null] }));
    };
}
function createButtonCss(buttonTheme) {
    let borderColor = createButtonBorderColor(buttonTheme.border);
    let hoverBorderColor = createButtonBorderColor(buttonTheme.backgroundHover);
    let activeBorderColor = createButtonBorderColor(buttonTheme.backgroundActive);
    return css({
        backgroundColor: buttonTheme.background,
        backgroundImage: createButtonBackgroundImage(buttonTheme.background),
        color: buttonTheme.foreground,
        border: `0.5px solid ${borderColor}`,
        boxShadow: `${createButtonHighlight(buttonTheme.background)}, ${theme.shadow.xs}, ${theme.shadow.sm}`,
        '&:hover': {
            backgroundColor: buttonTheme.backgroundHover,
            backgroundImage: createButtonBackgroundImage(buttonTheme.backgroundHover),
            borderColor: hoverBorderColor,
        },
        '&:active': {
            backgroundColor: buttonTheme.backgroundActive,
            backgroundImage: createButtonBackgroundImage(buttonTheme.backgroundActive),
            borderColor: activeBorderColor,
            boxShadow: `${createButtonHighlight(buttonTheme.backgroundActive, 0.12)}, ${theme.shadow.xs}`,
        },
        '&:focus-visible': {
            outline: `2px solid ${theme.colors.focus.ring}`,
            outlineOffset: '2px',
        },
        '&:disabled': {
            opacity: 0.6,
            cursor: 'not-allowed',
        },
    });
}
function createButtonBackgroundImage(background) {
    return `linear-gradient(to bottom, ${createButtonHighlightColor(background, 0.18)} 0%, ${background} 100%)`;
}
function createButtonBorderColor(color) {
    return `color-mix(in oklab, ${color} 74%, black)`;
}
function createButtonHighlight(background, amount = 0.16) {
    return `inset 0 1px 0 ${createButtonHighlightColor(background, amount)}`;
}
function createButtonHighlightColor(background, amount) {
    let alpha = Math.round(amount * 100);
    return `color-mix(in oklab, white ${alpha}%, ${background})`;
}
//# sourceMappingURL=button.js.map