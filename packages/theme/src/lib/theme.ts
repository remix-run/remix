import { createElement, css } from '@remix-run/component'
import type { RemixElement } from '@remix-run/component'

interface ThemeVariableTree {
  [key: string]: string | ThemeVariableTree
}
type ThemeScale = Record<string, string>

let themeVariableNames = {
  space: {
    0: '--rmx-space-0',
    px: '--rmx-space-px',
    xs: '--rmx-space-xs',
    sm: '--rmx-space-sm',
    md: '--rmx-space-md',
    lg: '--rmx-space-lg',
    xl: '--rmx-space-xl',
    '2xl': '--rmx-space-2xl',
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
    xs: '--rmx-font-size-xs',
    sm: '--rmx-font-size-sm',
    md: '--rmx-font-size-md',
    lg: '--rmx-font-size-lg',
    xl: '--rmx-font-size-xl',
    '2xl': '--rmx-font-size-2xl',
  },
  lineHeight: {
    tight: '--rmx-line-height-tight',
    normal: '--rmx-line-height-normal',
    relaxed: '--rmx-line-height-relaxed',
  },
  letterSpacing: {
    tight: '--rmx-letter-spacing-tight',
    normal: '--rmx-letter-spacing-normal',
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
    paddingInline: {
      sm: '--rmx-control-padding-inline-sm',
      md: '--rmx-control-padding-inline-md',
      lg: '--rmx-control-padding-inline-lg',
    },
  },
  shadow: {
    xs: '--rmx-shadow-xs',
    sm: '--rmx-shadow-sm',
    md: '--rmx-shadow-md',
    lg: '--rmx-shadow-lg',
    xl: '--rmx-shadow-xl',
  },
  duration: {
    fast: '--rmx-duration-fast',
    normal: '--rmx-duration-normal',
    slow: '--rmx-duration-slow',
  },
  easing: {
    standard: '--rmx-easing-standard',
    emphasized: '--rmx-easing-emphasized',
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
      inverse: '--rmx-color-text-inverse',
      link: '--rmx-color-text-link',
    },
    background: {
      canvas: '--rmx-color-background-canvas',
      surface: '--rmx-color-background-surface',
      surfaceSecondary: '--rmx-color-background-surface-secondary',
      surfaceElevated: '--rmx-color-background-surface-elevated',
      inset: '--rmx-color-background-inset',
      inverse: '--rmx-color-background-inverse',
    },
    border: {
      subtle: '--rmx-color-border-subtle',
      default: '--rmx-color-border-default',
      strong: '--rmx-color-border-strong',
      inverse: '--rmx-color-border-inverse',
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
type ThemeUtilityScale<scale extends ThemeScale> = {
  [key in keyof scale]: ThemeUtility
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
  bg: ThemeUtilityScale<typeof theme.colors.background>
  borderColor: ThemeUtilityScale<typeof theme.colors.border>
  shadow: ThemeUtilityScale<typeof theme.shadow>
  text: {
    body: ThemeUtility
    bodySm: ThemeUtility
    label: ThemeUtility
    eyebrow: ThemeUtility
    title: ThemeUtility
    display: ThemeUtility
  }
  ring: {
    focus: ThemeUtility
  }
  control: {
    base: ThemeUtility
    quiet: ThemeUtility
  }
  field: {
    base: ThemeUtility
  }
  surface: {
    base: ThemeUtility
    secondary: ThemeUtility
    elevated: ThemeUtility
    inset: ThemeUtility
  }
  status: {
    info: ThemeUtility
    success: ThemeUtility
    warning: ThemeUtility
    danger: ThemeUtility
  }
  button: {
    primary: ThemeUtility
    secondary: ThemeUtility
    danger: ThemeUtility
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
const backgroundUtilities = createSinglePropertyUtilities('backgroundColor', theme.colors.background)
const borderColorUtilities = createSinglePropertyUtilities('borderColor', theme.colors.border)
const shadowUtilities = createSinglePropertyUtilities('boxShadow', theme.shadow)

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
    eyebrow: css({
      fontSize: theme.fontSize.xs,
      lineHeight: theme.lineHeight.normal,
      fontWeight: theme.fontWeight.semibold,
      letterSpacing: theme.letterSpacing.wide,
      textTransform: 'uppercase',
      color: theme.colors.text.muted,
    }),
    title: css({
      fontSize: theme.fontSize.lg,
      lineHeight: theme.lineHeight.tight,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.text.primary,
    }),
    display: css({
      fontSize: theme.fontSize['2xl'],
      lineHeight: theme.lineHeight.tight,
      fontWeight: theme.fontWeight.bold,
      letterSpacing: theme.letterSpacing.tight,
      color: theme.colors.text.primary,
    }),
  },
  ring: {
    focus: css({
      '&:focus-visible': {
        outline: `2px solid ${theme.colors.focus.ring}`,
        outlineOffset: '2px',
      },
    }),
  },
  control: {
    base: css({
      position: 'relative',
      isolation: 'isolate',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: theme.control.height.sm,
      paddingInline: theme.control.paddingInline.md,
      overflow: 'hidden',
      borderRadius: theme.radius.full,
      fontFamily: theme.fontFamily.sans,
      fontSize: theme.fontSize.xs,
      lineHeight: '1',
      fontWeight: theme.fontWeight.medium,
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      transitionProperty: 'border-color, background-color, box-shadow, color',
      transitionDuration: theme.duration.fast,
      transitionTimingFunction: theme.easing.standard,
      boxShadow: `${theme.shadow.xs}, ${theme.shadow.sm}`,
    }),
    quiet: css({
      backgroundColor: theme.colors.background.surfaceSecondary,
      backgroundImage:
        'linear-gradient(to bottom, rgb(255 255 255 / 0.96) 0%, rgb(247 247 247 / 0.98) 100%)',
      color: theme.colors.text.secondary,
      border: `0.5px solid ${theme.colors.border.default}`,
      boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.7), ${theme.shadow.xs}, ${theme.shadow.sm}`,
      '&:hover': {
        backgroundColor: theme.colors.background.surface,
        color: theme.colors.text.primary,
      },
      '&:active': {
        backgroundColor: theme.colors.background.inset,
        boxShadow: `${theme.shadow.xs}`,
      },
      '&:focus-visible': {
        outline: `2px solid ${theme.colors.focus.ring}`,
        outlineOffset: '2px',
      },
      '&:disabled': {
        opacity: 0.6,
        cursor: 'not-allowed',
      },
    }),
  },
  field: {
    base: css({
      minHeight: theme.control.height.lg,
      width: '100%',
      paddingInline: theme.control.paddingInline.sm,
      border: `0.5px solid ${theme.colors.border.default}`,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.background.surface,
      color: theme.colors.text.primary,
      fontFamily: theme.fontFamily.sans,
      fontSize: theme.fontSize.sm,
      lineHeight: theme.lineHeight.normal,
      boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.7)`,
      '&:focus-visible': {
        outline: `2px solid ${theme.colors.focus.ring}`,
        outlineOffset: '2px',
      },
    }),
  },
  surface: {
    base: createSurfaceUtility({
      background: theme.colors.background.surface,
      border: theme.colors.border.subtle,
      shadow: theme.shadow.xs,
    }),
    secondary: createSurfaceUtility({
      background: theme.colors.background.surfaceSecondary,
      border: theme.colors.border.subtle,
      shadow: theme.shadow.xs,
    }),
    elevated: createSurfaceUtility({
      background: theme.colors.background.surfaceElevated,
      border: theme.colors.border.subtle,
      shadow: theme.shadow.md,
    }),
    inset: createSurfaceUtility({
      background: theme.colors.background.inset,
      border: theme.colors.border.subtle,
      shadow: 'none',
    }),
  },
  status: {
    info: createStatusUtility(theme.colors.status.info),
    success: createStatusUtility(theme.colors.status.success),
    warning: createStatusUtility(theme.colors.status.warning),
    danger: createStatusUtility(theme.colors.status.danger),
  },
  button: {
    primary: createButtonUtility(theme.colors.action.primary),
    secondary: createButtonUtility(theme.colors.action.secondary),
    danger: createButtonUtility(theme.colors.action.danger),
  },
}

export const RMX_01_VALUES: ThemeValues = {
  space: {
    0: '0px',
    px: '1px',
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
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
    xs: '12px',
    sm: '13px',
    md: '14px',
    lg: '16px',
    xl: '20px',
    '2xl': '28px',
  },
  fontFamily: {
    sans:
      '"Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.45',
    relaxed: '1.65',
  },
  letterSpacing: {
    tight: '-0.03em',
    normal: '0',
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
    paddingInline: {
      sm: '8px',
      md: '12px',
      lg: '16px',
    },
  },
  shadow: {
    xs: '0 1px 1px rgb(0 0 0 / 0.05)',
    sm: '0 1px 2px rgb(0 0 0 / 0.07)',
    md: '0 6px 18px rgb(0 0 0 / 0.08)',
    lg: '0 16px 34px rgb(0 0 0 / 0.10)',
    xl: '0 24px 52px rgb(0 0 0 / 0.14)',
  },
  duration: {
    fast: '120ms',
    normal: '180ms',
    slow: '260ms',
  },
  easing: {
    standard: 'ease',
    emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
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
      inverse: '#ffffff',
      link: '#2456d3',
    },
    background: {
      canvas: '#fdfdfd',
      surface: '#ffffff',
      surfaceSecondary: '#f8f8f8',
      surfaceElevated: '#ffffff',
      inset: '#f3f3f3',
      inverse: '#151515',
    },
    border: {
      subtle: '#e7e7e7',
      default: '#d1d1d1',
      strong: '#b0b0b0',
      inverse: '#4f4f4f',
    },
    focus: {
      ring: '#3d6cff',
    },
    overlay: {
      scrim: 'rgb(0 0 0 / 0.28)',
    },
    action: {
      primary: {
        background: '#3561cf',
        backgroundHover: '#2f57bb',
        backgroundActive: '#28489a',
        foreground: 'rgb(255 255 255 / 0.92)',
        border: '#3561cf',
      },
      secondary: {
        background: '#ffffff',
        backgroundHover: '#fbfbfb',
        backgroundActive: '#f3f3f3',
        foreground: '#202020',
        border: '#d1d1d1',
      },
      danger: {
        background: '#cf4a40',
        backgroundHover: '#ba4138',
        backgroundActive: '#97322b',
        foreground: 'rgb(255 255 255 / 0.92)',
        border: '#cf4a40',
      },
    },
    status: {
      info: {
        background: '#eef4ff',
        foreground: '#2456d3',
        border: '#c6d8ff',
      },
      success: {
        background: '#edf9f1',
        foreground: '#1d7a4f',
        border: '#bfe7cd',
      },
      warning: {
        background: '#fff7e8',
        foreground: '#9b6808',
        border: '#f1d392',
      },
      danger: {
        background: '#fff0ef',
        foreground: '#b23833',
        border: '#f0c1be',
      },
    },
  },
}

export const RMX_01 = createTheme(RMX_01_VALUES)

export function createTheme(
  values: ThemeValues,
  options: CreateThemeOptions = {},
): ThemeComponent {
  let selector = options.selector ?? ':root'
  let vars = Object.freeze(collectThemeVars(themeVariableNames, values))
  let cssText = serializeThemeCss(selector, vars)

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
  return mapTreeLeaves(tree, variableName => `var(${variableName})`) as MapLeaves<tree, string>
}

function mapTreeLeaves(tree: ThemeVariableTree, mapLeaf: (value: string) => string): ThemeVariableTree {
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
        throw new TypeError(`Expected theme value at "${nextPath.join('.')}" to be a string or number`)
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

function serializeThemeCss(selector: string, vars: ThemeVars): string {
  let lines = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')

  return `${selector} {\n${lines}\n}`
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

function createSurfaceUtility(options: {
  background: string
  border: string
  shadow: string
}) {
  return css({
    border: `1px solid ${options.border}`,
    borderRadius: theme.radius.lg,
    backgroundColor: options.background,
    boxShadow: options.shadow,
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
