import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { attrs, createElement, createMixin, css } from '@remix-run/ui';
import { componentStyleValues as styles } from "../shared/style-values.js";
const ghostButtonToneCss = css({
    backgroundColor: 'transparent',
    backgroundImage: 'none',
    color: styles.colors.text.secondary,
    border: '0.5px solid transparent',
    boxShadow: 'none',
    '&:hover': {
        backgroundColor: styles.surface.lvl3,
        color: styles.colors.text.primary,
    },
    '&:active': {
        backgroundColor: `color-mix(in oklab, ${styles.surface.lvl3} 94%, black)`,
        color: `color-mix(in oklab, ${styles.colors.text.primary} 94%, black)`,
    },
    '&:focus-visible': {
        outline: `2px solid ${styles.colors.focus.ring}`,
        outlineOffset: '2px',
        backgroundColor: styles.surface.lvl3,
        color: styles.colors.text.primary,
    },
    '&:disabled': {
        opacity: 0.6,
    },
});
const buttonBaseStyleCss = css({
    '--rmx-button-label-padding-inline': styles.space.xs,
    all: 'unset',
    boxSizing: 'border-box',
    cursor: 'revert',
    position: 'relative',
    isolation: 'isolate',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: styles.radius.full,
    fontFamily: styles.fontFamily.sans,
    minHeight: styles.control.height.sm,
    paddingInline: styles.space.md,
    fontSize: styles.fontSize.xs,
    lineHeight: '1',
    fontWeight: styles.fontWeight.medium,
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
const buttonIconAttrsCss = attrs({
    'aria-hidden': true,
});
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
/**
 * Base button styling with the default `type="button"` behavior for `<button>`
 * hosts. Compose with a tone style (e.g. {@link primaryStyle}) when applying
 * button styling without using the {@link Button} component.
 *
 * @category mixin
 */
export const baseStyle = [buttonDefaultsCss, buttonBaseStyleCss];
/**
 * Icon slot sizing and `aria-hidden` defaults for decorative icons rendered
 * inside a button.
 *
 * @category mixin
 */
export const iconStyle = [buttonIconAttrsCss, buttonIconCss];
/**
 * Inline label slot with the standard button label spacing.
 *
 * @category mixin
 */
export const labelStyle = buttonLabelCss;
/**
 * Primary visual treatment for buttons. Combine with {@link baseStyle} when
 * styling a non-`Button` host element.
 *
 * @category mixin
 */
export const primaryStyle = createButtonCss(styles.colors.action.primary);
/**
 * Secondary visual treatment for buttons. Combine with {@link baseStyle} when
 * styling a non-`Button` host element.
 *
 * @category mixin
 */
export const secondaryStyle = createButtonCss(styles.colors.action.secondary);
/**
 * Ghost visual treatment for buttons — transparent background with a hover
 * surface. Combine with {@link baseStyle} when styling a non-`Button` host
 * element.
 *
 * @category mixin
 */
export const ghostStyle = ghostButtonToneCss;
/**
 * Danger visual treatment for destructive actions. Combine with
 * {@link baseStyle} when styling a non-`Button` host element.
 *
 * @category mixin
 */
export const dangerStyle = createButtonCss(styles.colors.action.danger);
const toneStyleByTone = {
    primary: primaryStyle,
    secondary: secondaryStyle,
    ghost: ghostStyle,
    danger: dangerStyle,
};
/**
 * Renders a `<button>` with `baseStyle` and the resolved tone style, along with
 * optional start and end icons.
 *
 * @param handle Component handle providing the runtime API and the resolved {@link ButtonProps}.
 * @returns A render function for the button element.
 *
 * @example
 * ```tsx
 * import { Button } from '@remix-run/ui/components/button'
 *
 * <Button startIcon={<PlusIcon />} tone="primary">
 *   Create project
 * </Button>
 * ```
 */
export function Button(handle) {
    return () => {
        let { children, endIcon, mix, startIcon, tone = 'secondary', ...buttonProps } = handle.props;
        return (_jsxs("button", { ...buttonProps, mix: [baseStyle, toneStyleByTone[tone], mix], children: [startIcon ? _jsx("span", { mix: iconStyle, children: startIcon }) : null, children !== undefined ? _jsx("span", { mix: labelStyle, children: children }) : null, endIcon ? _jsx("span", { mix: iconStyle, children: endIcon }) : null] }));
    };
}
function createButtonCss(actionColors) {
    let borderColor = createButtonBorderColor(actionColors.border);
    let hoverBorderColor = createButtonBorderColor(actionColors.backgroundHover);
    let activeBorderColor = createButtonBorderColor(actionColors.backgroundActive);
    return css({
        backgroundColor: actionColors.background,
        backgroundImage: createButtonBackgroundImage(actionColors.background),
        color: actionColors.foreground,
        border: `0.5px solid ${borderColor}`,
        boxShadow: `${createButtonHighlight(actionColors.background)}, ${styles.shadow.xs}, ${styles.shadow.sm}`,
        '&:hover': {
            backgroundColor: actionColors.backgroundHover,
            backgroundImage: createButtonBackgroundImage(actionColors.backgroundHover),
            borderColor: hoverBorderColor,
        },
        '&:active': {
            backgroundColor: actionColors.backgroundActive,
            backgroundImage: createButtonBackgroundImage(actionColors.backgroundActive),
            borderColor: activeBorderColor,
            boxShadow: `${createButtonHighlight(actionColors.backgroundActive, 0.12)}, ${styles.shadow.xs}`,
        },
        '&:focus-visible': {
            outline: `2px solid ${styles.colors.focus.ring}`,
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