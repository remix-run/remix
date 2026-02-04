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

type StyleObject = Record<string, unknown>

// Convert camelCase CSS properties to kebab-case
function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

// Properties that should remain unitless (numeric values without px)
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

// Normalize numeric CSS values: append 'px' for properties that need units
// In Standards Mode, browsers drop numeric values without units when multiple properties
// are present in insertRule(). We must normalize them ourselves.
export function normalizeCssValue(key: string, value: unknown): string {
  if (value == null) return String(value)
  if (typeof value === 'number' && value !== 0) {
    let cssKey = camelToKebab(key)
    if (!NUMERIC_CSS_PROPS.has(cssKey) && !cssKey.startsWith('--')) {
      return `${value}px`
    }
  }
  return String(value)
}

// Check if a style property is a nested selector or media query
function isComplexSelector(key: string): boolean {
  return (
    key.startsWith('&') ||
    key.startsWith('@') ||
    key.startsWith(':') ||
    key.startsWith('[') ||
    key.startsWith('.')
  )
}

// Detect @keyframes (including vendor-prefixed variants)
function isKeyframesAtRule(key: string): boolean {
  if (!key.startsWith('@')) return false
  let lower = key.toLowerCase()
  return (
    lower.startsWith('@keyframes') ||
    lower.startsWith('@-webkit-keyframes') ||
    lower.startsWith('@-moz-keyframes') ||
    lower.startsWith('@-o-keyframes')
  )
}

// Generate a hash for style objects to create unique class names
function hashStyle(obj: any): string {
  // Sort keys to ensure consistent hashing, but include values in the string
  let sortedEntries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))
  let str = JSON.stringify(sortedEntries)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    let char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}

// Convert style object to CSS text
function styleToCss(styles: StyleObject, selector: string = ''): string {
  let baseDeclarations: string[] = []
  let nestedBlocks: string[] = []
  let atRules: string[] = []
  let preludeAtRules: string[] = []

  for (let [key, value] of Object.entries(styles)) {
    if (isComplexSelector(key)) {
      if (key.startsWith('@')) {
        // Allow at-rules to be conditionally disabled.
        // e.g. { '@media (min-width: 600px)': condition ? undefined : { ... } }
        let record = toRecord(value)
        if (!record) continue

        // Some at-rules (e.g., @media) scope declarations to the selector.
        // Others (e.g., @function) must NOT include the selector in their body.
        if (key.startsWith('@function')) {
          let body = atRuleBodyToCss(record)
          if (body.trim().length > 0) {
            preludeAtRules.push(`${key} {\n${indent(body, 2)}\n}`)
          } else {
            preludeAtRules.push(`${key} {\n}`)
          }
        } else if (isKeyframesAtRule(key)) {
          // Keyframes definitions must not be wrapped with the element selector.
          // Emit them before the class rule so animations can be referenced.
          let body = keyframesBodyToCss(record)
          if (body.trim().length > 0) {
            preludeAtRules.push(`${key} {\n${indent(body, 2)}\n}`)
          } else {
            preludeAtRules.push(`${key} {\n}`)
          }
        } else {
          // Default: keep at-rules nested with the element selector
          let inner = styleToCss(record, selector)
          if (inner.trim().length > 0) {
            atRules.push(`${key} {\n${indent(inner, 2)}\n}`)
          } else {
            // Empty at-rule body with selector block
            atRules.push(`${key} {\n  ${selector} {\n  }\n}`)
          }
        }
        continue
      }

      // For nested selectors, keep them wholesale inside the base block
      // Allow nested selectors to be conditionally disabled.
      // e.g. { '&:hover': condition ? undefined : { ... } }
      let record = toRecord(value)
      if (!record) continue

      let nestedContent = ''
      for (let [prop, propValue] of Object.entries(record)) {
        if (propValue != null) {
          let normalizedValue = normalizeCssValue(prop, propValue)
          nestedContent += `    ${camelToKebab(prop)}: ${normalizedValue};\n`
        }
      }
      if (nestedContent) {
        // Preserve key verbatim (e.g., '&[aria-selected], &[rmx-focus]')
        nestedBlocks.push(`  ${key} {\n${nestedContent}  }`)
      }
    } else {
      // Base declaration
      if (value != null) {
        let normalizedValue = normalizeCssValue(key, value)
        baseDeclarations.push(`  ${camelToKebab(key)}: ${normalizedValue};`)
      }
    }
  }

  let css = ''
  if (preludeAtRules.length > 0) {
    css += preludeAtRules.join('\n')
  }
  if (selector && (baseDeclarations.length > 0 || nestedBlocks.length > 0)) {
    css += (css ? '\n' : '') + `${selector} {\n`
    if (baseDeclarations.length > 0) {
      css += baseDeclarations.join('\n') + '\n'
    }
    if (nestedBlocks.length > 0) {
      css += nestedBlocks.join('\n') + '\n'
    }
    css += '}'
  }

  if (atRules.length > 0) {
    css += (css ? '\n' : '') + atRules.join('\n')
  }

  return css
}

function indent(text: string, spaces: number): string {
  let pad = ' '.repeat(spaces)
  return text
    .split('\n')
    .map((line) => (line.length ? pad + line : line))
    .join('\n')
}

// Narrow unknown values to plain record objects
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

// Build the body of a @keyframes rule (without wrapping selector)
function keyframesBodyToCss(frames: StyleObject): string {
  let blocks: string[] = []

  for (let [frameSelector, frameValue] of Object.entries(frames)) {
    if (!isRecord(frameValue)) {
      // Skip non-object frame definitions
      continue
    }

    let declarations: string[] = []
    for (let [prop, propValue] of Object.entries(frameValue)) {
      if (propValue == null) continue
      // Ignore nested selectors/at-rules inside keyframe steps
      if (isComplexSelector(prop)) continue
      let normalizedValue = normalizeCssValue(prop, propValue)
      declarations.push(`  ${camelToKebab(prop)}: ${normalizedValue};`)
    }

    if (declarations.length > 0) {
      blocks.push(`${frameSelector} {\n${declarations.join('\n')}\n}`)
    } else {
      blocks.push(`${frameSelector} {\n}`)
    }
  }

  return blocks.join('\n')
}

// Build the body for at-rules that should not include a selector wrapper (e.g., @function)
function atRuleBodyToCss(styles: StyleObject): string {
  let declarations: string[] = []
  let nested: string[] = []

  for (let [key, value] of Object.entries(styles)) {
    if (isComplexSelector(key)) {
      if (key.startsWith('@')) {
        // Nested at-rules inside definition blocks; render their bodies recursively without selectors
        let record = toRecord(value)
        if (!record) continue
        let inner = atRuleBodyToCss(record)
        if (inner.trim().length > 0) {
          nested.push(`${key} {\n${indent(inner, 2)}\n}`)
        } else {
          nested.push(`${key} {\n}`)
        }
      } else {
        // Ignore nested selectors (&, :, ., [) inside definition-style at-rules
        // They are not meaningful within e.g. @function bodies
        continue
      }
    } else {
      if (value != null) {
        let normalizedValue = normalizeCssValue(key, value)
        declarations.push(`  ${camelToKebab(key)}: ${normalizedValue};`)
      }
    }
  }

  let body = ''
  if (declarations.length > 0) {
    body += declarations.join('\n')
  }
  if (nested.length > 0) {
    body += (body ? '\n' : '') + nested.join('\n')
  }
  return body
}

// Process style prop and return selector value and CSS
export function processStyle(
  styleObj: CSSProps,
  styleCache: Map<string, { selector: string; css: string }>,
): {
  selector: string
  css: string
} {
  // Check if the object is empty
  if (Object.keys(styleObj).length === 0) {
    return { selector: '', css: '' }
  }

  // Generate a hash for the style object
  let hash = hashStyle(styleObj)
  let selector = `rmx-${hash}`

  // Check cache first
  let cached = styleCache.get(hash)
  if (cached) {
    return cached
  }

  // Generate CSS using attribute selector [data-css="..."]
  let css = styleToCss(styleObj, `[data-css="${selector}"]`)
  let result = { selector, css }

  // Store in cache
  styleCache.set(hash, result)

  return result
}

// Clear style cache (useful for testing)
export function clearStyleCache(styleCache: Map<string, { selector: string; css: string }>): void {
  styleCache.clear()
}
