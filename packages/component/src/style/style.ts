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

// Convert camelCase CSS properties to kebab-case, restoring the leading dash on
// vendor prefixes (`webkitLineClamp`, `msFlex` -> `-webkit-line-clamp`, `-ms-flex`).
// Custom properties are case-sensitive, so they're returned as written.
// Property names repeat constantly across renders; cache conversions instead
// of running a regex each time.
const CAMEL_TO_KEBAB_CACHE_LIMIT = 256
const camelToKebabCache = new Map<string, string>()

export function camelToKebab(str: string): string {
  if (str.startsWith('--')) return str
  let cached = camelToKebabCache.get(str)
  if (cached === undefined) {
    cached = str
      .replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
      .replace(/^(webkit|moz|ms|o)-/, '-$1-')
    if (camelToKebabCache.size >= CAMEL_TO_KEBAB_CACHE_LIMIT) {
      let oldest = camelToKebabCache.keys().next()
      if (!oldest.done) camelToKebabCache.delete(oldest.value)
    }
    camelToKebabCache.set(str, cached)
  }
  return cached
}

// Properties whose grammar accepts a standalone number, including shorthands
// and number/length unions. Numbers select the unitless branch; use a string
// with units to select a length. Audited against @webref/css 8.7.8 and legacy
// properties in mdn-data 2.27.1, retaining existing legacy entries.
// https://github.com/w3c/webref/tree/main/packages/css
// Matched after stripping vendor prefixes: WebkitLineClamp and msFlex use the
// line-clamp and flex entries; WebKit's mask-box-image aliases need their own.
const NUMERIC_CSS_PROPS = new Set([
  'animation',
  'animation-iteration-count',
  'aspect-ratio',
  'bookmark-level',
  'border-image',
  'border-image-outset',
  'border-image-slice',
  'border-image-width',
  'box-flex',
  'box-flex-group',
  'box-ordinal-group',
  'column-count',
  'column-span',
  'columns',
  'flex',
  'flex-grow',
  'flex-line-count',
  'flex-negative',
  'flex-order',
  'flex-positive',
  'flex-shrink',
  'float-defer',
  'font-size-adjust',
  'font-weight',
  'force-broken-image-icon',
  'grid-area',
  'grid-column',
  'grid-column-end',
  'grid-column-span',
  'grid-column-start',
  'grid-row',
  'grid-row-end',
  'grid-row-span',
  'grid-row-start',
  'hyphenate-limit-chars',
  'hyphenate-limit-lines',
  'initial-letter',
  'line-clamp',
  'line-height',
  'mask-border',
  'mask-border-outset',
  'mask-border-slice',
  'mask-border-width',
  'mask-box-image',
  'mask-box-image-outset',
  'mask-box-image-slice',
  'mask-box-image-width',
  'math-depth',
  'max-lines',
  'opacity',
  'order',
  'orphans',
  'reading-order',
  'scale',
  'shape-image-threshold',
  'tab-size',
  'voice-balance',
  'widows',
  'z-index',
  'zoom',
  // SVG
  'fill-opacity',
  'flood-opacity',
  'stop-opacity',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
])

const VENDOR_PREFIX_RE = /^-(?:webkit|moz|ms|o)-/

function isUnitlessCssProp(cssKey: string): boolean {
  return NUMERIC_CSS_PROPS.has(cssKey.replace(VENDOR_PREFIX_RE, ''))
}

// Numbers default to pixels, except for unitless properties, custom properties,
// and zero. Other units (such as time or angle) must be explicit strings.
// Returns undefined for values that shouldn't be emitted (nullish and non-finite numbers).
export function normalizeCssValue(key: string, value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined
    if (value !== 0 && !key.startsWith('--') && !isUnitlessCssProp(camelToKebab(key))) {
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

// Generate a hash for style objects to create unique class names.
// Class names are content-addressed — a collision silently applies the wrong
// styles — so use two independent 32-bit FNV-1a passes (~64 bits of hash
// space) rather than a single 32-bit hash. Must be deterministic across
// server and client.
function hashStyle(obj: CSSProps): string {
  // JSON drops undefined properties from client entry props. Omit them here too
  // so hydration reuses the server's class and its position in the CSS cascade.
  let sortedEntries = Object.entries(obj)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
  let str = JSON.stringify(sortedEntries)
  let h1 = 0x811c9dc5
  let h2 = 0xcbf29ce4
  for (let i = 0; i < str.length; i++) {
    let char = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ char, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ char, 0x01000193) >>> 0
  }
  return h1.toString(36) + h2.toString(36)
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

      // Allow nested selectors to be conditionally disabled.
      // e.g. { '&:hover': condition ? undefined : { ... } }
      let record = toRecord(value)
      if (!record) continue

      let nestedContent = nestedStyleBodyToCss(record, 4)
      if (nestedContent.trim().length > 0) {
        // Preserve key verbatim (e.g., '&[aria-selected], &[rmx-focus]')
        nestedBlocks.push(`  ${key} {\n${nestedContent}\n  }`)
      }
    } else {
      // Base declaration
      let normalizedValue = normalizeCssValue(key, value)
      if (normalizedValue !== undefined) {
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

function nestedStyleBodyToCss(styles: StyleObject, spaces: number): string {
  // This renders content that is already inside a style rule. Nested selectors
  // and nested at-rules can stay in that rule body; root at-rule placement is
  // handled by styleToCss before entering a nested style body.
  let pad = ' '.repeat(spaces)
  let declarations: string[] = []
  let nestedBlocks: string[] = []

  for (let [key, value] of Object.entries(styles)) {
    if (isComplexSelector(key)) {
      let record = toRecord(value)
      if (!record) continue

      let nestedContent = nestedStyleBodyToCss(record, spaces + 2)
      if (nestedContent.trim().length > 0) {
        nestedBlocks.push(`${pad}${key} {\n${nestedContent}\n${pad}}`)
      }
    } else {
      let normalizedValue = normalizeCssValue(key, value)
      if (normalizedValue !== undefined) {
        declarations.push(`${pad}${camelToKebab(key)}: ${normalizedValue};`)
      }
    }
  }

  return [...declarations, ...nestedBlocks].join('\n')
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
      // Ignore nested selectors/at-rules inside keyframe steps
      if (isComplexSelector(prop)) continue
      let normalizedValue = normalizeCssValue(prop, propValue)
      if (normalizedValue === undefined) continue
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
      let normalizedValue = normalizeCssValue(key, value)
      if (normalizedValue !== undefined) {
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

export function processStyleClass(
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
  let selector = `rmxc-${hash}`

  // Check cache first
  let cached = styleCache.get(hash)
  if (cached) {
    return cached
  }

  let css = styleToCss(styleObj, `.${selector}`)
  let result = { selector, css }

  // Store in cache
  styleCache.set(hash, result)

  return result
}

// Clear style cache (useful for testing)
export function clearStyleCache(styleCache: Map<string, { selector: string; css: string }>): void {
  styleCache.clear()
}
