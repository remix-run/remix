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
// Vendor prefixes are optional: WebkitLineClamp and msFlex use the line-clamp
// and flex entries; WebKit's mask-box-image aliases need their own.
const NUMERIC_CSS_PROP = new RegExp(
  '^(?:-(?:webkit|moz|ms|o)-)?(?:' +
    'animation(?:-iteration-count)?|aspect-ratio|bookmark-level|' +
    '(?:border-image|mask-border|mask-box-image)(?:-outset|-slice|-width)?|' +
    'box-(?:flex|flex-group|ordinal-group)|column(?:s|-count|-span)|' +
    'flex(?:-grow|-line-count|-negative|-order|-positive|-shrink)?|float-defer|' +
    'font-(?:size-adjust|weight)|force-broken-image-icon|' +
    'grid-(?:area|(?:column|row)(?:-end|-span|-start)?)|hyphenate-limit-(?:chars|lines)|' +
    'initial-letter|line-(?:clamp|height)|math-depth|max-lines|opacity|order|orphans|' +
    'reading-order|scale|shape-image-threshold|tab-size|voice-balance|widows|z-index|zoom|' +
    // SVG
    '(?:fill|flood|stop|stroke)-opacity|stroke-(?:dasharray|dashoffset|miterlimit|width)' +
    ')$',
)

// Numbers default to pixels, except for unitless properties, custom properties,
// and zero. Other units (such as time or angle) must be explicit strings.
// Returns undefined for values that shouldn't be emitted (nullish and non-finite numbers).
export function normalizeCssValue(key: string, value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined
    if (value !== 0 && !key.startsWith('--') && !NUMERIC_CSS_PROP.test(camelToKebab(key))) {
      return `${value}px`
    }
  }
  return String(value)
}

// Check if a style property is a nested selector or media query
function isComplexSelector(key: string): boolean {
  return /^[&@:.[]/.test(key)
}

// Detect @keyframes (including vendor-prefixed variants)
function isKeyframesAtRule(key: string): boolean {
  return /^@(?:-(?:webkit|moz|o)-)?keyframes/.test(key.toLowerCase())
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
function styleToCss(styles: StyleObject, selector: string): string {
  let preludeAtRules: string[] = []
  let atRules: string[] = []
  let body = styleBodyToCss(styles, '  ', (key, record) => {
    if (!key.startsWith('@')) return nestedRuleToCss(key, record, '  ')

    // Some at-rules (e.g., @media) scope declarations to the selector.
    // Others (e.g., @function) must NOT include the selector in their body.
    if (key.startsWith('@function')) {
      preludeAtRules.push(ruleToCss(key, indent(atRuleBodyToCss(record))))
    } else if (isKeyframesAtRule(key)) {
      // Keyframes definitions must not be wrapped with the element selector.
      // Emit them before the class rule so animations can be referenced.
      preludeAtRules.push(ruleToCss(key, indent(keyframesBodyToCss(record))))
    } else {
      // Default: keep at-rules nested with the element selector, even when empty
      let inner = styleToCss(record, selector) || ruleToCss(selector, '')
      atRules.push(ruleToCss(key, indent(inner)))
    }
  })

  let rule = body ? [ruleToCss(selector, body)] : []
  return [...preludeAtRules, ...rule, ...atRules].join('\n')
}

// Render declarations, followed by the rules renderRule returns for nested selectors and at-rules
function styleBodyToCss(
  styles: StyleObject,
  pad: string,
  renderRule?: (key: string, record: StyleObject) => string | undefined,
): string {
  let declarations: string[] = []
  let rules: string[] = []

  for (let [key, value] of Object.entries(styles)) {
    if (isComplexSelector(key)) {
      // Allow nested rules to be conditionally disabled.
      // e.g. { '&:hover': condition ? undefined : { ... } }
      let rule = isRecord(value) ? renderRule?.(key, value) : undefined
      if (rule) rules.push(rule)
    } else {
      let normalizedValue = normalizeCssValue(key, value)
      if (normalizedValue !== undefined) {
        declarations.push(`${pad}${camelToKebab(key)}: ${normalizedValue};`)
      }
    }
  }

  return [...declarations, ...rules].join('\n')
}

// Render a rule that is already inside a style rule. Nested selectors and nested at-rules can stay
// in that rule body; root at-rule placement is handled by styleToCss.
function nestedRuleToCss(key: string, styles: StyleObject, pad: string): string | undefined {
  let bodyPad = pad + '  '
  let body = styleBodyToCss(styles, bodyPad, (nestedKey, record) =>
    nestedRuleToCss(nestedKey, record, bodyPad),
  )
  // Preserve key verbatim (e.g., '&[aria-selected], &[rmx-focus]')
  if (body) return `${pad}${key} {\n${body}\n${pad}}`
}

function ruleToCss(selector: string, body: string): string {
  return body ? `${selector} {\n${body}\n}` : `${selector} {\n}`
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.length ? '  ' + line : line))
    .join('\n')
}

// Narrow unknown values to plain record objects
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Build the body of a @keyframes rule (without wrapping selector)
function keyframesBodyToCss(frames: StyleObject): string {
  let blocks: string[] = []

  for (let [frameSelector, frameValue] of Object.entries(frames)) {
    // Skip non-object frame definitions and ignore nested selectors/at-rules inside keyframe steps
    if (isRecord(frameValue)) {
      blocks.push(ruleToCss(frameSelector, styleBodyToCss(frameValue, '  ')))
    }
  }

  return blocks.join('\n')
}

// Build the body for at-rules that should not include a selector wrapper (e.g., @function).
// Nested selectors (&, :, ., [) aren't meaningful there, so only nested at-rules are rendered.
function atRuleBodyToCss(styles: StyleObject): string {
  return styleBodyToCss(styles, '  ', (key, record) =>
    key.startsWith('@') ? ruleToCss(key, indent(atRuleBodyToCss(record))) : undefined,
  )
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
