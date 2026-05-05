// @jsxRuntime classic
// @jsx createElement
import { attrs, createElement, createMixin, css } from '@remix-run/ui'
import type { CSSMixinDescriptor, ElementProps, Handle, Props, RemixNode } from '@remix-run/ui'

import { theme } from '../../theme/theme.ts'

const ghostButtonToneCss: CSSMixinDescriptor = css({
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
})

const buttonBaseStyleCss: CSSMixinDescriptor = css({
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
})

const buttonLabelCss: CSSMixinDescriptor = css({
  display: 'inline-flex',
  alignItems: 'center',
  minWidth: 0,
  paddingInline: 'var(--rmx-button-label-padding-inline)',
})

const buttonIconCss: CSSMixinDescriptor = css({
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
})

const buttonIconAttrsCss = attrs({ 'aria-hidden': true })

const buttonDefaultsMixin = createMixin<Element, [], ElementProps>(
  (handle, hostType) => (props) => {
    if (hostType !== 'button' || props.type !== undefined) {
      return handle.element
    }

    return createElement(handle.element as unknown as string, {
      ...props,
      type: 'button',
    })
  },
)

const buttonDefaultsCss = buttonDefaultsMixin()

/**
 * Base button styling with the default `type="button"` behavior for `<button>`
 * hosts. Compose with a tone style (e.g. {@link primaryStyle}) when applying
 * button styling without using the {@link Button} component.
 *
 * @category mixin
 */
export const baseStyle = [buttonDefaultsCss, buttonBaseStyleCss] as const

/**
 * Icon slot sizing and `aria-hidden` defaults for decorative icons rendered
 * inside a button.
 *
 * @category mixin
 */
export const iconStyle = [buttonIconAttrsCss, buttonIconCss] as const

/**
 * Inline label slot with the standard button label spacing.
 *
 * @category mixin
 */
export const labelStyle = buttonLabelCss

/**
 * Primary visual treatment for buttons. Combine with {@link baseStyle} when
 * styling a non-`Button` host element.
 *
 * @category mixin
 */
export const primaryStyle = createButtonCss(theme.colors.action.primary)

/**
 * Secondary visual treatment for buttons. Combine with {@link baseStyle} when
 * styling a non-`Button` host element.
 *
 * @category mixin
 */
export const secondaryStyle = createButtonCss(theme.colors.action.secondary)

/**
 * Ghost visual treatment for buttons — transparent background with a hover
 * surface. Combine with {@link baseStyle} when styling a non-`Button` host
 * element.
 *
 * @category mixin
 */
export const ghostStyle = ghostButtonToneCss

/**
 * Danger visual treatment for destructive actions. Combine with
 * {@link baseStyle} when styling a non-`Button` host element.
 *
 * @category mixin
 */
export const dangerStyle = createButtonCss(theme.colors.action.danger)

const toneStyleByTone = {
  primary: primaryStyle,
  secondary: secondaryStyle,
  ghost: ghostStyle,
  danger: dangerStyle,
} as const

/**
 * Visual treatment supported by {@link Button} — `'primary'`, `'secondary'`,
 * `'ghost'`, or `'danger'`.
 */
export type ButtonTone = keyof typeof toneStyleByTone

/**
 * Props accepted by the {@link Button} component.
 *
 * Extends the native `<button>` element props with optional icon slots and a
 * tone variant
 */
export type ButtonProps = Omit<Props<'button'>, 'children'> & {
  /**
   * Content rendered inside the button's label slot.
   */
  readonly children?: RemixNode
  /**
   * Decorative icon rendered after the label, inside the icon slot.
   */
  readonly endIcon?: RemixNode
  /**
   * Decorative icon rendered before the label, inside the icon slot.
   */
  readonly startIcon?: RemixNode
  /**
   * Visual treatment to apply to the button (default `'secondary'`).
   */
  readonly tone?: ButtonTone
}

/**
 * Renders a `<button>` with `baseStyle` and the resolved tone style, along with
 * optional start and end icons.
 *
 * @param handle Component handle providing the runtime API and the resolved {@link ButtonProps}.
 * @returns A render function for the button element.
 *
 * @example
 * ```tsx
 * import { Button } from '@remix-run/ui/button'
 * import { Glyph } from '@remix-run/ui/glyph'
 *
 * <Button startIcon={<Glyph name="add" />} tone="primary">
 *   Create project
 * </Button>
 * ```
 */
export function Button(handle: Handle<ButtonProps>) {
  return () => {
    let { children, endIcon, mix, startIcon, tone = 'secondary', ...buttonProps } = handle.props

    return (
      <button {...buttonProps} mix={[baseStyle, toneStyleByTone[tone], mix]}>
        {startIcon ? <span mix={iconStyle}>{startIcon}</span> : null}
        {children !== undefined ? <span mix={labelStyle}>{children}</span> : null}
        {endIcon ? <span mix={iconStyle}>{endIcon}</span> : null}
      </button>
    )
  }
}

function createButtonCss(buttonTheme: {
  background: string
  backgroundHover: string
  backgroundActive: string
  foreground: string
  border: string
}): CSSMixinDescriptor {
  let borderColor = createButtonBorderColor(buttonTheme.border)
  let hoverBorderColor = createButtonBorderColor(buttonTheme.backgroundHover)
  let activeBorderColor = createButtonBorderColor(buttonTheme.backgroundActive)

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
  })
}

function createButtonBackgroundImage(background: string) {
  return `linear-gradient(to bottom, ${createButtonHighlightColor(background, 0.18)} 0%, ${background} 100%)`
}

function createButtonBorderColor(color: string) {
  return `color-mix(in oklab, ${color} 74%, black)`
}

function createButtonHighlight(background: string, amount = 0.16) {
  return `inset 0 1px 0 ${createButtonHighlightColor(background, amount)}`
}

function createButtonHighlightColor(background: string, amount: number) {
  let alpha = Math.round(amount * 100)
  return `color-mix(in oklab, white ${alpha}%, ${background})`
}
