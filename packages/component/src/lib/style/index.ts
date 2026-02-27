import { createStyleManager } from './lib/stylesheet.ts'

export type {
  CSSProps as EnhancedStyleProperties,
  DOMStyleProperties as StyleProperties,
} from './lib/style.ts'
export { processStyleClass, normalizeCssValue } from './lib/style.ts'
export { createStyleManager }

export type StyleManager = ReturnType<typeof createStyleManager>
