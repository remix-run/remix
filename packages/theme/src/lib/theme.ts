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
  fontSize: {
    xs: '--rmx-font-size-xs',
    sm: '--rmx-font-size-sm',
    md: '--rmx-font-size-md',
    lg: '--rmx-font-size-lg',
    xl: '--rmx-font-size-xl',
  },
  lineHeight: {
    tight: '--rmx-line-height-tight',
    normal: '--rmx-line-height-normal',
    relaxed: '--rmx-line-height-relaxed',
  },
  fontWeight: {
    normal: '--rmx-font-weight-normal',
    medium: '--rmx-font-weight-medium',
    semibold: '--rmx-font-weight-semibold',
    bold: '--rmx-font-weight-bold',
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
  ring: {
    focus: ThemeUtility
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
  ring: {
    focus: css({
      '&:focus-visible': {
        outline: `2px solid ${theme.colors.focus.ring}`,
        outlineOffset: '2px',
      },
    }),
  },
  button: {
    primary: createButtonUtility(theme.colors.action.primary),
    secondary: createButtonUtility(theme.colors.action.secondary),
    danger: createButtonUtility(theme.colors.action.danger),
  },
}

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

function createButtonUtility(buttonTheme: {
  background: string
  backgroundHover: string
  backgroundActive: string
  foreground: string
  border: string
}) {
  return css({
    backgroundColor: buttonTheme.background,
    color: buttonTheme.foreground,
    border: `1px solid ${buttonTheme.border}`,
    '&:hover': {
      backgroundColor: buttonTheme.backgroundHover,
    },
    '&:active': {
      backgroundColor: buttonTheme.backgroundActive,
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
