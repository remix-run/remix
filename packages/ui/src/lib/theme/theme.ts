import { attrs, createElement, createMixin, css, spring } from '@remix-run/component'
import type { ElementProps, RemixElement } from '@remix-run/component'
import type { MixinDescriptor } from '@remix-run/component'

interface ThemeVariableTree {
  [key: string]: string | ThemeVariableTree
}
type ThemeScale = Record<string, string>

let themeVariableNames = {
  space: {
    none: '--rmx-space-none',
    px: '--rmx-space-px',
    xs: '--rmx-space-xs',
    sm: '--rmx-space-sm',
    md: '--rmx-space-md',
    lg: '--rmx-space-lg',
    xl: '--rmx-space-xl',
    xxl: '--rmx-space-xxl',
  },
  radius: {
    none: '--rmx-radius-none',
    sm: '--rmx-radius-sm',
    md: '--rmx-radius-md',
    lg: '--rmx-radius-lg',
    xl: '--rmx-radius-xl',
    full: '--rmx-radius-full',
  },
  fontFamily: {
    sans: '--rmx-font-family-sans',
    mono: '--rmx-font-family-mono',
  },
  fontSize: {
    xxxs: '--rmx-font-size-xxxs',
    xxs: '--rmx-font-size-xxs',
    xs: '--rmx-font-size-xs',
    sm: '--rmx-font-size-sm',
    md: '--rmx-font-size-md',
    lg: '--rmx-font-size-lg',
    xl: '--rmx-font-size-xl',
    xxl: '--rmx-font-size-xxl',
  },
  lineHeight: {
    tight: '--rmx-line-height-tight',
    normal: '--rmx-line-height-normal',
    relaxed: '--rmx-line-height-relaxed',
  },
  letterSpacing: {
    tight: '--rmx-letter-spacing-tight',
    normal: '--rmx-letter-spacing-normal',
    meta: '--rmx-letter-spacing-meta',
    wide: '--rmx-letter-spacing-wide',
  },
  fontWeight: {
    normal: '--rmx-font-weight-normal',
    medium: '--rmx-font-weight-medium',
    semibold: '--rmx-font-weight-semibold',
    bold: '--rmx-font-weight-bold',
  },
  control: {
    height: {
      sm: '--rmx-control-height-sm',
      md: '--rmx-control-height-md',
      lg: '--rmx-control-height-lg',
    },
  },
  surface: {
    lvl0: '--rmx-surface-lvl0',
    lvl1: '--rmx-surface-lvl1',
    lvl2: '--rmx-surface-lvl2',
    lvl3: '--rmx-surface-lvl3',
    lvl4: '--rmx-surface-lvl4',
  },
  shadow: {
    xs: '--rmx-shadow-xs',
    sm: '--rmx-shadow-sm',
    md: '--rmx-shadow-md',
    lg: '--rmx-shadow-lg',
    xl: '--rmx-shadow-xl',
  },
  zIndex: {
    dropdown: '--rmx-z-index-dropdown',
    popover: '--rmx-z-index-popover',
    sticky: '--rmx-z-index-sticky',
    overlay: '--rmx-z-index-overlay',
    modal: '--rmx-z-index-modal',
    toast: '--rmx-z-index-toast',
    tooltip: '--rmx-z-index-tooltip',
  },
  colors: {
    text: {
      primary: '--rmx-color-text-primary',
      secondary: '--rmx-color-text-secondary',
      muted: '--rmx-color-text-muted',
      link: '--rmx-color-text-link',
    },
    border: {
      subtle: '--rmx-color-border-subtle',
      default: '--rmx-color-border-default',
      strong: '--rmx-color-border-strong',
    },
    focus: {
      ring: '--rmx-color-focus-ring',
    },
    overlay: {
      scrim: '--rmx-color-overlay-scrim',
    },
    action: {
      primary: {
        background: '--rmx-color-action-primary-background',
        backgroundHover: '--rmx-color-action-primary-background-hover',
        backgroundActive: '--rmx-color-action-primary-background-active',
        foreground: '--rmx-color-action-primary-foreground',
        border: '--rmx-color-action-primary-border',
      },
      secondary: {
        background: '--rmx-color-action-secondary-background',
        backgroundHover: '--rmx-color-action-secondary-background-hover',
        backgroundActive: '--rmx-color-action-secondary-background-active',
        foreground: '--rmx-color-action-secondary-foreground',
        border: '--rmx-color-action-secondary-border',
      },
      danger: {
        background: '--rmx-color-action-danger-background',
        backgroundHover: '--rmx-color-action-danger-background-hover',
        backgroundActive: '--rmx-color-action-danger-background-active',
        foreground: '--rmx-color-action-danger-foreground',
        border: '--rmx-color-action-danger-border',
      },
    },
    status: {
      info: {
        background: '--rmx-color-status-info-background',
        foreground: '--rmx-color-status-info-foreground',
        border: '--rmx-color-status-info-border',
      },
      success: {
        background: '--rmx-color-status-success-background',
        foreground: '--rmx-color-status-success-foreground',
        border: '--rmx-color-status-success-border',
      },
      warning: {
        background: '--rmx-color-status-warning-background',
        foreground: '--rmx-color-status-warning-foreground',
        border: '--rmx-color-status-warning-border',
      },
      danger: {
        background: '--rmx-color-status-danger-background',
        foreground: '--rmx-color-status-danger-foreground',
        border: '--rmx-color-status-danger-border',
      },
    },
  },
} as const satisfies ThemeVariableTree

type MapLeaves<source, leaf> = source extends string
  ? leaf
  : {
      [key in keyof source]: MapLeaves<source[key], leaf>
    }

export type ThemeValue = string | number
export type ThemeValues = MapLeaves<typeof themeVariableNames, ThemeValue>
export type ThemeVars = Readonly<Record<string, string>>
export type CreateThemeOptions = {
  selector?: string
  reset?: boolean
}
export type ThemeStyleProps = {
  nonce?: string
}
type ThemeRenderer = () => (props?: ThemeStyleProps) => RemixElement

export type ThemeComponent = ThemeRenderer & {
  Style: ThemeRenderer
  cssText: string
  selector: string
  values: ThemeValues
  vars: ThemeVars
}

export const theme = createThemeContract(themeVariableNames)
export type ThemeUtility = ReturnType<typeof css>
type ThemeMixLeaf = MixinDescriptor<any, any, any>
type PreviousThemeMixDepth = [0, 0, 1, 2, 3, 4]
type NestedThemeMix<value, depth extends number = 4> = depth extends 0
  ? value | ReadonlyArray<value>
  : value | ReadonlyArray<NestedThemeMix<value, PreviousThemeMixDepth[depth]>>
export type ThemeMix = NestedThemeMix<ThemeMixLeaf>
type ThemeUtilityScale<scale extends ThemeScale> = {
  [key in keyof scale]: ThemeUtility
}
type ThemeAxisUtility = ThemeUtility & {
  start: ThemeUtility
  center: ThemeUtility
  end: ThemeUtility
  between: ThemeUtility
  wrap: ThemeUtility
}
export type ThemeUi = {
  p: ThemeUtilityScale<typeof theme.space>
  px: ThemeUtilityScale<typeof theme.space>
  py: ThemeUtilityScale<typeof theme.space>
  m: ThemeUtilityScale<typeof theme.space>
  mx: ThemeUtilityScale<typeof theme.space>
  my: ThemeUtilityScale<typeof theme.space>
  mt: ThemeUtilityScale<typeof theme.space>
  mr: ThemeUtilityScale<typeof theme.space>
  mb: ThemeUtilityScale<typeof theme.space>
  ml: ThemeUtilityScale<typeof theme.space>
  gap: ThemeUtilityScale<typeof theme.space>
  rounded: ThemeUtilityScale<typeof theme.radius>
  textSize: ThemeUtilityScale<typeof theme.fontSize>
  fontWeight: ThemeUtilityScale<typeof theme.fontWeight>
  textColor: ThemeUtilityScale<typeof theme.colors.text>
  bg: ThemeUtilityScale<typeof theme.surface>
  borderColor: ThemeUtilityScale<typeof theme.colors.border>
  shadow: ThemeUtilityScale<typeof theme.shadow>
  icon: {
    sm: ThemeUtility
    md: ThemeUtility
    lg: ThemeUtility
  }
  animation: {
    spin: (duration?: string) => ThemeUtility
  }
  text: {
    body: ThemeUtility
    bodySm: ThemeUtility
    label: ThemeUtility
    eyebrow: ThemeUtility
    caption: ThemeUtility
    code: ThemeUtility
    supporting: ThemeUtility
    title: ThemeUtility
    display: ThemeUtility
  }
  field: {
    base: ThemeUtility
  }
  fieldText: {
    label: ThemeUtility
    help: ThemeUtility
  }
  sidebar: {
    panel: ThemeUtility
    section: ThemeUtility
    heading: ThemeUtility
  }
  row: ThemeAxisUtility
  stack: ThemeAxisUtility
  nav: {
    list: ThemeUtility
    item: ThemeUtility
    itemActive: ThemeMix
    itemMuted: ThemeMix
  }
  card: {
    base: ThemeMix
    secondary: ThemeMix
    elevated: ThemeMix
    inset: ThemeMix
    stack: ThemeUtility
    header: ThemeUtility
    headerWithAction: ThemeUtility
    body: ThemeUtility
    footer: ThemeUtility
    eyebrow: ThemeUtility
    title: ThemeUtility
    description: ThemeUtility
    action: ThemeUtility
  }
  item: {
    base: ThemeUtility
    selected: ThemeMix
    danger: ThemeMix
  }
  status: {
    info: ThemeUtility
    success: ThemeUtility
    warning: ThemeUtility
    danger: ThemeUtility
  }
  button: {
    base: ThemeMix
    label: ThemeUtility
    icon: ThemeMix
    sm: ThemeUtility
    md: ThemeUtility
    lg: ThemeUtility
    iconOnly: ThemeUtility
    tone: {
      primary: ThemeUtility
      secondary: ThemeUtility
      ghost: ThemeUtility
      danger: ThemeUtility
    }
    primary: ThemeMix
    secondary: ThemeMix
    ghost: ThemeMix
    danger: ThemeMix
    select: ThemeMix
  }
  accordion: {
    root: ThemeUtility
    item: ThemeMix
    trigger: ThemeUtility
    indicator: ThemeUtility
    panel: ThemeUtility
    body: ThemeUtility
  }
  popover: {
    surface: ThemeMix
    button: ThemeMix
    content: ThemeUtility
  }
  combobox: {
    input: ThemeMix
    popover: ThemeMix
  }
  menu: {
    button: ThemeMix
    popover: ThemeMix
    list: ThemeMix
    itemLabel: ThemeMix
    item: ThemeMix
    itemGlyph: ThemeMix
    trigger: ThemeMix
    triggerGlyph: ThemeMix
  }
  listbox: {
    surface: ThemeMix
    option: ThemeMix
    label: ThemeMix
    glyph: ThemeMix
  }
}

const spacingUtilities = createSinglePropertyUtilities('padding', theme.space)
const paddingInlineUtilities = createSinglePropertyUtilities('paddingInline', theme.space)
const paddingBlockUtilities = createSinglePropertyUtilities('paddingBlock', theme.space)
const marginUtilities = createSinglePropertyUtilities('margin', theme.space)
const marginInlineUtilities = createSinglePropertyUtilities('marginInline', theme.space)
const marginBlockUtilities = createSinglePropertyUtilities('marginBlock', theme.space)
const marginTopUtilities = createSinglePropertyUtilities('marginTop', theme.space)
const marginRightUtilities = createSinglePropertyUtilities('marginRight', theme.space)
const marginBottomUtilities = createSinglePropertyUtilities('marginBottom', theme.space)
const marginLeftUtilities = createSinglePropertyUtilities('marginLeft', theme.space)
const gapUtilities = createSinglePropertyUtilities('gap', theme.space)
const roundedUtilities = createSinglePropertyUtilities('borderRadius', theme.radius)
const fontSizeUtilities = createSinglePropertyUtilities('fontSize', theme.fontSize)
const fontWeightUtilities = createSinglePropertyUtilities('fontWeight', theme.fontWeight)
const textColorUtilities = createSinglePropertyUtilities('color', theme.colors.text)
const backgroundUtilities = createSinglePropertyUtilities('backgroundColor', theme.surface)
const borderColorUtilities = createSinglePropertyUtilities('borderColor', theme.colors.border)
const shadowUtilities = createSinglePropertyUtilities('boxShadow', theme.shadow)

let iconSizeUtilities = {
  sm: css({
    width: theme.fontSize.xs,
    height: theme.fontSize.xs,
  }),
  md: css({
    width: theme.fontSize.sm,
    height: theme.fontSize.sm,
  }),
  lg: css({
    width: theme.fontSize.lg,
    height: theme.fontSize.lg,
  }),
}

let animationUtilities = {
  spin(duration = '850ms') {
    return css({
      animation: `rmx-spin ${duration} linear infinite`,
      '@keyframes rmx-spin': {
        from: {
          transform: 'rotate(0deg)',
        },
        to: {
          transform: 'rotate(360deg)',
        },
      },
      '@media (prefers-reduced-motion: reduce)': {
        animation: 'none',
      },
    })
  },
}

let ghostButtonToneUtility = css({
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

let buttonBaseStyleUtility = css({
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
  lineHeight: '1',
  fontWeight: theme.fontWeight.medium,
  whiteSpace: 'nowrap',
  textDecoration: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  verticalAlign: 'top',
})

let buttonLabelUtility = css({
  display: 'inline-flex',
  alignItems: 'center',
  minWidth: 0,
  paddingInline: 'var(--rmx-button-label-padding-inline)',
})

let buttonIconUtility = css({
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

let buttonIconAttrsUtility = attrs({ 'aria-hidden': true })

let buttonSizeSmUtility = css({
  minHeight: `calc(${theme.control.height.sm} - 4px)`,
  paddingInline: theme.space.sm,
  fontSize: theme.fontSize.xxs,
})

let buttonSizeMdUtility = css({
  minHeight: theme.control.height.sm,
  paddingInline: theme.space.md,
  fontSize: theme.fontSize.xs,
})

let buttonSizeLgUtility = css({
  minHeight: theme.control.height.md,
  paddingInline: theme.space.lg,
  fontSize: theme.fontSize.sm,
  '--rmx-button-label-padding-inline': theme.space.sm,
})

let buttonSizeIconOnlyUtility = css({
  minHeight: theme.control.height.sm,
  inlineSize: theme.control.height.sm,
  paddingInline: '0',
  gap: '0',
})

let surfaceBaseUtility = createSurfaceUtility({
  background: theme.surface.lvl0,
  border: theme.colors.border.subtle,
  shadow: theme.shadow.xs,
})

let surfaceSecondaryUtility = createSurfaceUtility({
  background: theme.surface.lvl1,
  border: theme.colors.border.subtle,
  shadow: theme.shadow.xs,
})

let surfaceTertiaryUtility = createSurfaceUtility({
  background: theme.surface.lvl2,
  border: theme.colors.border.subtle,
  shadow: theme.shadow.xs,
})

let surfaceElevatedUtility = createSurfaceUtility({
  background: theme.surface.lvl4,
  border: theme.colors.border.subtle,
  shadow: theme.shadow.md,
})

let surfaceInsetUtility = createSurfaceUtility({
  background: theme.surface.lvl3,
  border: theme.colors.border.subtle,
  shadow: 'none',
})

let cardFrameUtility = createCardFrameUtility()

let navItemUtility = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.sm,
  minHeight: theme.control.height.md,
  padding: `${theme.space.xs} ${theme.space.sm}`,
  border: `1px solid transparent`,
  borderRadius: theme.radius.md,
  color: theme.colors.text.secondary,
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.normal,
  fontWeight: theme.fontWeight.medium,
  textDecoration: 'none',
  transitionProperty: 'background-color, border-color, color, box-shadow',
  transitionDuration: '120ms',
  transitionTimingFunction: 'ease',
  '&:hover': {
    backgroundColor: theme.surface.lvl0,
    color: theme.colors.text.primary,
  },
})

let navItemActiveToneUtility = css({
  backgroundColor: theme.surface.lvl0,
  borderColor: theme.colors.border.subtle,
  color: theme.colors.text.primary,
  boxShadow: theme.shadow.xs,
})

let navItemMutedToneUtility = css({
  color: theme.colors.text.muted,
})

let itemBaseUtility = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.sm,
  width: '100%',
  minHeight: theme.control.height.md,
  padding: `${theme.space.xs} ${theme.space.sm}`,
  border: '1px solid transparent',
  borderRadius: theme.radius.md,
  backgroundColor: 'transparent',
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
  textAlign: 'left',
})

let itemSelectedToneUtility = css({
  backgroundColor: theme.surface.lvl1,
  borderColor: theme.colors.border.subtle,
  boxShadow: theme.shadow.xs,
})

let itemDangerToneUtility = css({
  color: theme.colors.status.danger.foreground,
  borderColor: theme.colors.status.danger.border,
  backgroundColor: theme.colors.status.danger.background,
})

let rowBaseUtility = css({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  minWidth: 0,
})

let rowStartUtility = css({
  alignItems: 'flex-start',
})

let rowCenterUtility = css({
  alignItems: 'center',
})

let rowEndUtility = css({
  alignItems: 'flex-end',
})

let rowBetweenUtility = css({
  justifyContent: 'space-between',
})

let rowWrapUtility = css({
  flexWrap: 'wrap',
})

let stackBaseUtility = css({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
})

let stackStartUtility = css({
  alignItems: 'flex-start',
})

let stackCenterUtility = css({
  alignItems: 'center',
})

let stackEndUtility = css({
  alignItems: 'flex-end',
})

let stackBetweenUtility = css({
  justifyContent: 'space-between',
})

let stackWrapUtility = css({
  flexWrap: 'wrap',
})

let rowUtility = Object.assign(rowBaseUtility, {
  start: rowStartUtility,
  center: rowCenterUtility,
  end: rowEndUtility,
  between: rowBetweenUtility,
  wrap: rowWrapUtility,
}) as ThemeAxisUtility

let stackUtility = Object.assign(stackBaseUtility, {
  start: stackStartUtility,
  center: stackCenterUtility,
  end: stackEndUtility,
  between: stackBetweenUtility,
  wrap: stackWrapUtility,
}) as ThemeAxisUtility

let buttonDefaultsMixin = createMixin<Element, [], ElementProps>((handle, hostType) => (props) => {
  if (hostType !== 'button' || props.type !== undefined) {
    return handle.element
  }

  return createElement(handle.element as unknown as string, {
    ...props,
    type: 'button',
  })
})

let buttonDefaultsUtility = buttonDefaultsMixin()

let primaryButtonToneUtility = createButtonUtility(theme.colors.action.primary)

let secondaryButtonToneUtility = createButtonUtility(theme.colors.action.secondary)

let dangerButtonToneUtility = createButtonUtility(theme.colors.action.danger)

let buttonToneUtilities = {
  primary: primaryButtonToneUtility,
  secondary: secondaryButtonToneUtility,
  ghost: ghostButtonToneUtility,
  danger: dangerButtonToneUtility,
}

let popupTriggerOpenUtility = css({
  '&[aria-expanded="true"], &[aria-expanded="true"]:hover, &[aria-expanded="true"]:focus-visible': {
    backgroundColor: theme.surface.lvl3,
    color: theme.colors.text.primary,
  },
})
let popoverButtonUtility = css({
  minHeight: theme.control.height.sm,
  paddingInline: theme.space.md,
  paddingInlineEnd: theme.space.sm,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: theme.space.sm,
  borderRadius: theme.radius.md,
  backgroundColor: 'transparent',
  backgroundImage: 'none',
  color: theme.colors.text.secondary,
  border: '0.5px solid transparent',
  boxShadow: 'none',
  fontSize: theme.fontSize.xs,
  textAlign: 'left',
  '&:hover, &:focus-visible, &[aria-expanded="true"], &[aria-expanded="true"]:hover, &[aria-expanded="true"]:focus-visible':
    {
      backgroundColor: theme.surface.lvl3,
      color: theme.colors.text.primary,
    },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '2px',
  },
  '&:disabled': {
    opacity: 0.6,
  },
})
let selectButtonUtility = css({
  width: '100%',
  backgroundColor: theme.surface.lvl3,
  '&:hover, &:focus-visible, &[aria-expanded="true"], &[aria-expanded="true"]:hover, &[aria-expanded="true"]:focus-visible':
    {
      backgroundColor: theme.surface.lvl4,
    },
  '&:active': {
    backgroundColor: theme.surface.lvl3,
  },
})

let accordionRootUtility = css({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
})
let accordionTransition = spring()
let accordionItemUtility = css({
  minWidth: 0,
})
let accordionTriggerUtility = css({
  all: 'unset',
  boxSizing: 'border-box',
  cursor: 'revert',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: theme.space.md,
  width: '100%',
  minHeight: theme.control.height.lg,
  padding: `${theme.space.md} 0`,
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.normal,
  fontWeight: theme.fontWeight.medium,
  textAlign: 'left',
  '&:hover:not(:disabled)': {
    backgroundColor: theme.surface.lvl1,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '2px',
  },
  '&:disabled': {
    opacity: 0.55,
  },
  '& > span:first-child': {
    minWidth: 0,
  },
})
let accordionIndicatorUtility = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: theme.fontSize.sm,
  height: theme.fontSize.sm,
  color: theme.colors.text.muted,
  transition: `transform ${accordionTransition}`,
  '&[data-state="open"]': {
    transform: 'rotate(90deg)',
  },
})
let accordionPanelUtility = css({
  display: 'grid',
  gridTemplateRows: '0fr',
  transition: `grid-template-rows ${accordionTransition}`,
  '&[data-state="open"]': {
    gridTemplateRows: '1fr',
  },
  '&[data-state="closed"]': {
    pointerEvents: 'none',
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
})
let accordionBodyUtility = css({
  display: 'flow-root',
  minHeight: 0,
  paddingBottom: theme.space.md,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  '& > :first-child': {
    marginTop: 0,
  },
  '& > :last-child': {
    marginBottom: 0,
  },
})
let popoverBaseUtility = css({
  position: 'fixed',
  inset: 'auto',
  margin: 0,
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: theme.colors.text.primary,
  overflow: 'visible',
  zIndex: theme.zIndex.popover,
  '&::backdrop': {
    background: 'transparent',
  },
})
let popupViewportClampMaxHeight = '50dvh'
let popoverSurfaceUtility = css({
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  backgroundColor: theme.surface.lvl0,
  minWidth: '12rem',
  maxWidth: `min(24rem, calc(100vw - (${theme.space.lg} * 2)))`,
  maxHeight: popupViewportClampMaxHeight,
  padding: theme.space.none,
  overflow: 'hidden',
  opacity: 0,
  '&:popover-open': {
    opacity: 1,
  },
  '&:not(:popover-open)': {
    pointerEvents: 'none',
    transition: 'opacity 180ms ease-in, overlay 180ms ease-in, display 180ms ease-in',
    transitionBehavior: 'allow-discrete',
  },
})
let comboboxPopoverUtility = css({
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  backgroundColor: theme.surface.lvl0,
  minWidth: '12rem',
  maxWidth: `min(24rem, calc(100vw - (${theme.space.lg} * 2)))`,
  maxHeight: popupViewportClampMaxHeight,
  padding: theme.space.none,
  overflow: 'hidden',
  opacity: 0,
  '&:popover-open': {
    opacity: 1,
  },
  '&:not(:popover-open)': {
    pointerEvents: 'none',
  },
  '&[data-show-reason="nav"]:not(:popover-open)': {
    transition: 'opacity 180ms ease-in, overlay 180ms ease-in, display 180ms ease-in',
    transitionBehavior: 'allow-discrete',
  },
  '&[data-show-reason="hint"]:not(:popover-open)': {
    transition: 'none',
    transitionBehavior: 'normal',
  },
})
let fieldBaseUtility = css({
  minHeight: theme.control.height.lg,
  width: '100%',
  paddingInline: theme.space.sm,
  border: `0.5px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  backgroundColor: theme.surface.lvl0,
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.normal,
  boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.7)`,
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: theme.space.none,
  },
})
let comboboxInputUtility = css({
  '&[data-surface-visible="true"][aria-activedescendant]:focus-visible': {
    outline: 'none',
  },
})
let popoverDepthUtility = css({
  boxShadow: `${theme.shadow.xs}, ${theme.shadow.md}`,
})

let popupTriggerUtility = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  borderRadius: theme.radius.md,
  paddingInlineEnd: theme.space.sm,
  textAlign: 'left',
})

let popupListUtility = css({
  display: 'flex',
  flexDirection: 'column',
  outline: 'none',
})

let popoverContentUtility = css({
  flex: '1 1 auto',
  minHeight: 0,
  padding: theme.space.xs,
  overflow: 'auto',
  overscrollBehavior: 'contain',
})

let listboxSurfaceUtility = [
  popupListUtility,
  css({ userSelect: 'none', WebkitUserSelect: 'none' }),
]

let menuPopoverUtility = css({
  backgroundColor: theme.surface.lvl4,
  '&[data-close-animation="none"]:not(:popover-open)': {
    transition: 'none',
    transitionBehavior: 'normal',
  },
})

let menuItemBaseUtility = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  alignItems: 'center',
  width: '100%',
  minHeight: theme.control.height.md,
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderRadius: theme.radius.md,
  backgroundColor: 'transparent',
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.normal,
  lineHeight: theme.lineHeight.normal,
  textAlign: 'left',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  '&:focus': {
    outline: 'none',
  },
  '&[data-highlighted="true"]': {
    backgroundColor: theme.colors.action.primary.background,
    color: theme.colors.action.primary.foreground,
  },
  '&[aria-haspopup="menu"][aria-expanded="true"]:not(:focus)': {
    backgroundColor: theme.surface.lvl2,
    color: theme.colors.text.primary,
  },
  '&[data-flash="true"]': {
    backgroundColor: theme.colors.action.primary.background,
    color: theme.colors.action.primary.foreground,
  },
  '&[data-highlighted="true"][data-flash="true"]': {
    backgroundColor: 'transparent',
    color: theme.colors.text.primary,
  },
  '&[aria-disabled="true"]': {
    opacity: 0.5,
  },
})

let menuSubmenuTriggerUtility = css({
  gridTemplateColumns: 'minmax(0, 1fr) max-content',
})

let menuSubmenuTriggerGlyphUtility = css({
  justifySelf: 'end',
})

let listboxOptionUtility = css({
  gridTemplateColumns: 'max-content minmax(0, 1fr)',
  scrollMarginBlock: theme.space.xs,
  '--rmx-listbox-option-indicator-opacity': '0',
  '&[hidden]': {
    display: 'none',
  },
  '&[data-listbox-flash="true"], &[data-select-flash="true"], &[data-combobox-flash="true"]': {
    backgroundColor: 'transparent',
    color: theme.colors.text.primary,
  },
  '&[aria-selected="true"]': {
    '--rmx-listbox-option-indicator-opacity': '1',
  },
})

let listboxOptionIndicatorUtility = css({
  gridColumn: '1',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '1em',
  height: '1em',
  color: 'currentColor',
  flexShrink: 0,
  opacity: 'var(--rmx-listbox-option-indicator-opacity)',
  '& > svg': {
    display: 'block',
    width: '100%',
    height: '100%',
  },
})

let popupItemGlyphUtility = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: theme.fontSize.md,
  height: theme.fontSize.md,
  color: 'currentColor',
  flexShrink: 0,
  '& > svg': {
    display: 'block',
    width: '100%',
    height: '100%',
  },
})

let popupItemLabelUtility = css({
  display: 'block',
  minWidth: 0,
})

let listboxLabelUtility = css({
  display: 'inline-flex',
  alignItems: 'center',
  minWidth: 0,
  paddingInline: theme.space.xs,
  WebkitUserSelect: 'none',
})

export const ui: ThemeUi = {
  p: spacingUtilities,
  px: paddingInlineUtilities,
  py: paddingBlockUtilities,
  m: marginUtilities,
  mx: marginInlineUtilities,
  my: marginBlockUtilities,
  mt: marginTopUtilities,
  mr: marginRightUtilities,
  mb: marginBottomUtilities,
  ml: marginLeftUtilities,
  gap: gapUtilities,
  rounded: roundedUtilities,
  textSize: fontSizeUtilities,
  fontWeight: fontWeightUtilities,
  textColor: textColorUtilities,
  bg: backgroundUtilities,
  borderColor: borderColorUtilities,
  shadow: shadowUtilities,
  icon: iconSizeUtilities,
  animation: animationUtilities,
  text: {
    body: css({
      fontSize: theme.fontSize.md,
      lineHeight: theme.lineHeight.relaxed,
      color: theme.colors.text.secondary,
    }),
    bodySm: css({
      fontSize: theme.fontSize.sm,
      lineHeight: theme.lineHeight.relaxed,
      color: theme.colors.text.secondary,
    }),
    label: css({
      fontSize: theme.fontSize.xs,
      lineHeight: theme.lineHeight.normal,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.text.secondary,
    }),
    caption: css({
      fontSize: theme.fontSize.xxs,
      lineHeight: theme.lineHeight.normal,
      color: theme.colors.text.muted,
    }),
    code: css({
      fontFamily: theme.fontFamily.mono,
      fontSize: theme.fontSize.xs,
      lineHeight: theme.lineHeight.normal,
      color: theme.colors.text.secondary,
    }),
    eyebrow: css({
      fontSize: theme.fontSize.xs,
      lineHeight: theme.lineHeight.normal,
      fontWeight: theme.fontWeight.semibold,
      letterSpacing: theme.letterSpacing.wide,
      textTransform: 'uppercase',
      color: theme.colors.text.muted,
    }),
    supporting: css({
      fontSize: theme.fontSize.sm,
      lineHeight: theme.lineHeight.normal,
      color: theme.colors.text.muted,
    }),
    title: css({
      fontSize: theme.fontSize.lg,
      lineHeight: theme.lineHeight.tight,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.text.primary,
    }),
    display: css({
      fontSize: theme.fontSize.xxl,
      lineHeight: theme.lineHeight.tight,
      fontWeight: theme.fontWeight.bold,
      letterSpacing: theme.letterSpacing.tight,
      color: theme.colors.text.primary,
    }),
  },
  field: {
    base: fieldBaseUtility,
  },
  fieldText: {
    label: css({
      fontSize: theme.fontSize.xs,
      lineHeight: theme.lineHeight.normal,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.text.secondary,
    }),
    help: css({
      fontSize: theme.fontSize.xxs,
      lineHeight: theme.lineHeight.normal,
      color: theme.colors.text.muted,
    }),
  },
  sidebar: {
    panel: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.space.lg,
      minWidth: 0,
    }),
    section: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.space.xs,
      minWidth: 0,
    }),
    heading: css({
      margin: 0,
      fontSize: theme.fontSize.xxs,
      lineHeight: theme.lineHeight.normal,
      fontWeight: theme.fontWeight.semibold,
      letterSpacing: theme.letterSpacing.meta,
      textTransform: 'uppercase',
      color: theme.colors.text.muted,
    }),
  },
  row: rowUtility,
  stack: stackUtility,
  nav: {
    list: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.space.xs,
      minWidth: 0,
    }),
    item: navItemUtility,
    itemActive: [navItemUtility, navItemActiveToneUtility],
    itemMuted: [navItemUtility, navItemMutedToneUtility],
  },
  card: {
    base: [cardFrameUtility, surfaceBaseUtility],
    secondary: [cardFrameUtility, surfaceSecondaryUtility],
    elevated: [cardFrameUtility, surfaceElevatedUtility],
    inset: [cardFrameUtility, surfaceInsetUtility],
    stack: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.space.md,
      minWidth: 0,
    }),
    header: css({
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
      minWidth: 0,
    }),
    headerWithAction: css({
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      alignItems: 'start',
      gap: theme.space.md,
    }),
    body: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.space.sm,
      minWidth: 0,
    }),
    footer: css({
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: theme.space.sm,
      marginTop: 'auto',
      marginRight: `calc(${theme.space.lg} * -1)`,
      marginBottom: `calc(${theme.space.lg} * -1)`,
      marginLeft: `calc(${theme.space.lg} * -1)`,
      padding: `${theme.space.md} ${theme.space.lg} ${theme.space.lg}`,
      borderTop: `1px solid ${theme.colors.border.subtle}`,
      backgroundColor: theme.surface.lvl1,
    }),
    eyebrow: css({
      margin: 0,
      fontSize: theme.fontSize.xxxs,
      lineHeight: theme.lineHeight.normal,
      fontWeight: theme.fontWeight.medium,
      letterSpacing: theme.letterSpacing.meta,
      textTransform: 'uppercase',
      color: `color-mix(in oklab, ${theme.colors.text.muted} 76%, white)`,
    }),
    title: css({
      margin: 0,
      fontSize: theme.fontSize.lg,
      lineHeight: '1.16',
      fontWeight: theme.fontWeight.medium,
      letterSpacing: '-0.022em',
      color: theme.colors.text.primary,
    }),
    description: css({
      margin: `${theme.space.sm} 0 0`,
      fontSize: theme.fontSize.xs,
      lineHeight: '1.48',
      color: `color-mix(in oklab, ${theme.colors.text.secondary} 72%, white)`,
    }),
    action: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifySelf: 'end',
      alignSelf: 'start',
      flexShrink: 0,
    }),
  },
  item: {
    base: itemBaseUtility,
    selected: [itemBaseUtility, itemSelectedToneUtility],
    danger: [itemBaseUtility, itemDangerToneUtility],
  },
  status: {
    info: createStatusUtility(theme.colors.status.info),
    success: createStatusUtility(theme.colors.status.success),
    warning: createStatusUtility(theme.colors.status.warning),
    danger: createStatusUtility(theme.colors.status.danger),
  },
  button: {
    base: [buttonDefaultsUtility, buttonBaseStyleUtility],
    label: buttonLabelUtility,
    icon: [buttonIconAttrsUtility, buttonIconUtility],
    sm: buttonSizeSmUtility,
    md: buttonSizeMdUtility,
    lg: buttonSizeLgUtility,
    iconOnly: buttonSizeIconOnlyUtility,
    tone: buttonToneUtilities,
    primary: [
      buttonDefaultsUtility,
      buttonBaseStyleUtility,
      buttonSizeMdUtility,
      buttonToneUtilities.primary,
    ],
    secondary: [
      buttonDefaultsUtility,
      buttonBaseStyleUtility,
      buttonSizeMdUtility,
      buttonToneUtilities.secondary,
    ],
    ghost: [
      buttonDefaultsUtility,
      buttonBaseStyleUtility,
      buttonSizeMdUtility,
      buttonToneUtilities.ghost,
    ],
    danger: [
      buttonDefaultsUtility,
      buttonBaseStyleUtility,
      buttonSizeMdUtility,
      buttonToneUtilities.danger,
    ],
    select: [
      buttonDefaultsUtility,
      buttonBaseStyleUtility,
      popoverButtonUtility,
      selectButtonUtility,
    ],
  },
  accordion: {
    root: accordionRootUtility,
    item: accordionItemUtility,
    trigger: accordionTriggerUtility,
    indicator: accordionIndicatorUtility,
    panel: accordionPanelUtility,
    body: accordionBodyUtility,
  },
  popover: {
    surface: [popoverBaseUtility, surfaceBaseUtility, popoverDepthUtility, popoverSurfaceUtility],
    button: [buttonDefaultsUtility, buttonBaseStyleUtility, popoverButtonUtility],
    content: popoverContentUtility,
  },
  combobox: {
    input: [fieldBaseUtility, comboboxInputUtility],
    popover: [popoverBaseUtility, surfaceBaseUtility, popoverDepthUtility, comboboxPopoverUtility],
  },
  menu: {
    button: [
      buttonDefaultsUtility,
      buttonBaseStyleUtility,
      buttonSizeMdUtility,
      buttonToneUtilities.ghost,
      popupTriggerUtility,
      popupTriggerOpenUtility,
    ],
    popover: [
      popoverBaseUtility,
      surfaceElevatedUtility,
      popoverSurfaceUtility,
      menuPopoverUtility,
    ],
    list: [popupListUtility, roundedUtilities.lg],
    item: menuItemBaseUtility,
    itemLabel: popupItemLabelUtility,
    itemGlyph: popupItemGlyphUtility,
    trigger: [menuItemBaseUtility, menuSubmenuTriggerUtility],
    triggerGlyph: [popupItemGlyphUtility, menuSubmenuTriggerGlyphUtility],
  },
  listbox: {
    surface: listboxSurfaceUtility,
    option: [menuItemBaseUtility, listboxOptionUtility],
    label: listboxLabelUtility,
    glyph: listboxOptionIndicatorUtility,
  },
}

export const RMX_01_VALUES: ThemeValues = {
  space: {
    none: '0px',
    px: '1px',
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },
  radius: {
    none: '0px',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  fontSize: {
    xxxs: '10px',
    xxs: '11px',
    xs: '12px',
    sm: '13px',
    md: '14px',
    lg: '16px',
    xl: '20px',
    xxl: '28px',
  },
  fontFamily: {
    sans: '"Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.45',
    relaxed: '1.65',
  },
  letterSpacing: {
    tight: '-0.03em',
    normal: '0',
    meta: '0.06em',
    wide: '0.08em',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  control: {
    height: {
      sm: '28px',
      md: '32px',
      lg: '36px',
    },
  },
  surface: {
    lvl0: '#ffffff',
    lvl1: '#f8f8f8',
    lvl2: '#f5f5f5',
    lvl3: '#f3f3f3',
    lvl4: '#efefef',
  },
  shadow: {
    xs: '0 1px 1px rgb(0 0 0 / 0.05)',
    sm: '0 1px 2px rgb(0 0 0 / 0.07)',
    md: '0 6px 18px rgb(0 0 0 / 0.08)',
    lg: '0 16px 34px rgb(0 0 0 / 0.10)',
    xl: '0 24px 52px rgb(0 0 0 / 0.14)',
  },
  zIndex: {
    dropdown: '1000',
    popover: '1100',
    sticky: '1200',
    overlay: '1300',
    modal: '1400',
    toast: '1500',
    tooltip: '1600',
  },
  colors: {
    text: {
      primary: '#151515',
      secondary: '#4f4f4f',
      muted: '#6d6d6d',
      link: '#1A72FF',
    },
    border: {
      subtle: '#e7e7e7',
      default: '#d1d1d1',
      strong: '#b0b0b0',
    },
    focus: {
      ring: '#1A72FF',
    },
    overlay: {
      scrim: 'rgb(0 0 0 / 0.28)',
    },
    action: {
      primary: {
        background: '#1A72FF',
        backgroundHover: '#1463e0',
        backgroundActive: '#0f55c9',
        foreground: 'rgb(255 255 255 / 0.92)',
        border: '#1A72FF',
      },
      secondary: {
        background: '#ffffff',
        backgroundHover: '#fbfbfb',
        backgroundActive: '#f3f3f3',
        foreground: '#202020',
        border: '#d1d1d1',
      },
      danger: {
        background: '#FF3000',
        backgroundHover: '#e12b00',
        backgroundActive: '#c52600',
        foreground: 'rgb(255 255 255 / 0.92)',
        border: '#FF3000',
      },
    },
    status: {
      info: {
        background: '#eaf2ff',
        foreground: '#1A72FF',
        border: '#b9d4ff',
      },
      success: {
        background: '#EAF7E6',
        foreground: '#41882a',
        border: '#b7dda9',
      },
      warning: {
        background: '#fff8d6',
        foreground: '#8f7300',
        border: '#ebdb7a',
      },
      danger: {
        background: '#ffe8e0',
        foreground: '#ca3e17',
        border: '#ffbfae',
      },
    },
  },
}

export const RMX_01 = createTheme(RMX_01_VALUES)

export function createTheme(values: ThemeValues, options: CreateThemeOptions = {}): ThemeComponent {
  let selector = options.selector ?? ':root'
  let reset = options.reset ?? true
  let vars = Object.freeze(collectThemeVars(themeVariableNames, values))
  let cssText = serializeThemeCss(selector, vars, { reset })

  function Theme() {
    return (props: ThemeStyleProps = {}) =>
      createElement('style', {
        nonce: props.nonce,
        'data-rmx-theme': '',
        'data-rmx-theme-selector': selector,
        innerHTML: escapeStyleText(cssText),
      })
  }

  return Object.assign(Theme, {
    Style: Theme,
    cssText,
    selector,
    values,
    vars,
  })
}

function createThemeContract<tree extends ThemeVariableTree>(tree: tree): MapLeaves<tree, string> {
  return mapTreeLeaves(tree, (variableName) => `var(${variableName})`) as MapLeaves<tree, string>
}

function mapTreeLeaves(
  tree: ThemeVariableTree,
  mapLeaf: (value: string) => string,
): ThemeVariableTree {
  let output: ThemeVariableTree = {}

  for (let [key, value] of Object.entries(tree)) {
    if (typeof value === 'string') {
      output[key] = mapLeaf(value)
      continue
    }

    output[key] = mapTreeLeaves(value, mapLeaf)
  }

  return output
}

function collectThemeVars(
  tree: ThemeVariableTree,
  values: ThemeValues,
  path: string[] = [],
): Record<string, string> {
  let vars: Record<string, string> = {}

  for (let [key, value] of Object.entries(tree)) {
    let nextPath = [...path, key]
    let themeValue = (values as Record<string, unknown>)[key]

    if (typeof value === 'string') {
      if (typeof themeValue !== 'string' && typeof themeValue !== 'number') {
        throw new TypeError(
          `Expected theme value at "${nextPath.join('.')}" to be a string or number`,
        )
      }

      vars[value] = String(themeValue)
      continue
    }

    if (!isPlainObject(themeValue)) {
      throw new TypeError(`Expected theme group at "${nextPath.join('.')}" to be an object`)
    }

    Object.assign(vars, collectThemeVars(value, themeValue as ThemeValues, nextPath))
  }

  return vars
}

function serializeThemeCss(selector: string, vars: ThemeVars, options: { reset: boolean }): string {
  let lines = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')

  let blocks = [`${selector} {\n${lines}\n}`]

  if (options.reset) {
    blocks.push(serializeThemeResetCss(selector))
  }

  return blocks.join('\n\n')
}

function serializeThemeResetCss(selector: string): string {
  let fontFamily = theme.fontFamily.sans
  let fontSize = theme.fontSize.md
  let lineHeight = theme.lineHeight.normal
  let textColor = theme.colors.text.primary
  let backgroundColor = theme.surface.lvl0
  if (selector === ':root') {
    return [
      `*, *::before, *::after {\n  box-sizing: border-box;\n}`,
      `html, body {\n  margin: 0;\n}`,
      `body {\n  font-family: ${fontFamily};\n  font-size: ${fontSize};\n  line-height: ${lineHeight};\n  color: ${textColor};\n  background-color: ${backgroundColor};\n}`,
      `:where(h1, h2, h3, h4, h5, h6, p, ul, ol, dl, figure, blockquote) {\n  margin: 0;\n}`,
      `:where(img, svg) {\n  display: block;\n}`,
    ].join('\n\n')
  }

  return [
    `${selector}, ${selector} *, ${selector} *::before, ${selector} *::after {\n  box-sizing: border-box;\n}`,
    `${selector} {\n  font-family: ${fontFamily};\n  font-size: ${fontSize};\n  line-height: ${lineHeight};\n  color: ${textColor};\n  background-color: ${backgroundColor};\n}`,
    `${selector} :where(h1, h2, h3, h4, h5, h6, p, ul, ol, dl, figure, blockquote) {\n  margin: 0;\n}`,
    `${selector} :where(img, svg) {\n  display: block;\n}`,
  ].join('\n\n')
}

function escapeStyleText(cssText: string): string {
  return cssText.replace(/<\/style/gi, '<\\/style')
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function createSinglePropertyUtilities<scale extends ThemeScale>(
  property: string,
  scale: scale,
): ThemeUtilityScale<scale> {
  let utilities = {} as ThemeUtilityScale<scale>

  for (let key of Object.keys(scale) as Array<keyof scale>) {
    utilities[key] = css({ [property]: scale[key] })
  }

  return utilities
}

function createSurfaceUtility(options: { background: string; border: string; shadow: string }) {
  return css({
    border: `1px solid ${options.border}`,
    borderRadius: theme.radius.lg,
    backgroundColor: options.background,
    boxShadow: options.shadow,
  })
}

function createCardFrameUtility() {
  return css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.space.md,
    minWidth: 0,
    padding: theme.space.lg,
    overflow: 'hidden',
  })
}

function createStatusUtility(statusTheme: {
  background: string
  foreground: string
  border: string
}) {
  return css({
    backgroundColor: statusTheme.background,
    color: statusTheme.foreground,
    borderColor: statusTheme.border,
  })
}

function createButtonUtility(buttonTheme: {
  background: string
  backgroundHover: string
  backgroundActive: string
  foreground: string
  border: string
}) {
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
