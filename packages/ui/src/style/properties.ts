export type DOMStyleProperties = {
  [key in keyof Omit<
    CSSStyleDeclaration,
    'item' | 'setProperty' | 'removeProperty' | 'getPropertyValue' | 'getPropertyPriority'
  >]?: string | number | null | undefined
}

export type AllStyleProperties = {
  [key: string]: string | number | null | undefined
}

export interface StyleProps extends AllStyleProperties, DOMStyleProperties {
  cssText?: string | null
}

// allow nesting
export interface CSSProps extends DOMStyleProperties {
  [key: string]: CSSProps | string | number | null | undefined
}

const NUMERIC_CSS_PROPS = new Set([
  'aspect-ratio',
  'z-index',
  'opacity',
  'flex-grow',
  'flex-shrink',
  'flex-order',
  'grid-area',
  'grid-row',
  'grid-column',
  'font-weight',
  'line-height',
  'order',
  'orphans',
  'widows',
  'zoom',
  'columns',
  'column-count',
])

export function toCssPropertyName(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

export function normalizeCssValue(key: string, value: unknown): string {
  if (value == null) return String(value)
  if (typeof value === 'number' && value !== 0) {
    let cssKey = toCssPropertyName(key)
    if (!NUMERIC_CSS_PROPS.has(cssKey) && !cssKey.startsWith('--')) {
      return `${value}px`
    }
  }
  return String(value)
}
