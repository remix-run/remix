import { createStyleManager } from './stylesheet.ts'

export type {
  CSSProps as EnhancedStyleProperties,
  DOMStyleProperties as StyleProperties,
} from './style.ts'
export { processStyleClass, normalizeCssValue } from './style.ts'
export { createStyleManager }

export type StyleManager = ReturnType<typeof createStyleManager>
