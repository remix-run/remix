import { createMixin, renderMixinElement } from '../runtime/mixins/mixin.ts'
import type { MixinFactory, MixinType } from '../runtime/mixins/mixin.ts'
import type { MixinDescriptor } from '../runtime/mixins/mixin.ts'
import type { ElementProps } from '../runtime/core/vnode.ts'
import { invariant } from '../runtime/invariant.ts'
import {
  getDefaultStyleManager,
  type DOMStyleProperties,
  type ServerStyleSource,
} from './stylesheet.ts'
import { camelToKebab, isStyleObject, normalizeCssValue } from '../runtime/core/props.ts'

export interface CSSProps extends DOMStyleProperties {
  [key: string]: CSSProps | string | number | null | undefined
}

type StyleObject = Record<string, unknown>
type StyleEntry = { selector: string; css: string }
type StyleCache = Map<string, StyleEntry>
type StyleManagerLike = {
  insert(className: string, rule: string): void
  remove(className: string): void
  getGeneration?(): number
  adoptServerStyles?(source: ServerStyleSource): Set<string>
}

/**
 * Descriptor produced by `css(...)` for composing generated styles with other host mixins.
 */
export type CSSMixinDescriptor = MixinDescriptor<Element, [styles: CSSProps], ElementProps>

const clientStyleCache: StyleCache = new Map()

export const cssMixinType: MixinType<Element, [styles: CSSProps], ElementProps> = (handle) => {
  let activeSelector = ''
  let activeGeneration = -1

  handle.addEventListener('remove', () => {
    if (!activeSelector) return
    runtime().styleManager?.remove(activeSelector)
    activeSelector = ''
    activeGeneration = -1
  })

  return (styles, props) => {
    let { styleManager, styleCache = clientStyleCache } = runtime()
    let { selector, css: cssText } = processStyleClass(styles, styleCache)
    let styleGeneration = styleManager?.getGeneration?.() ?? 0

    if (styleManager) {
      if (activeSelector && activeSelector !== selector) {
        styleManager.remove(activeSelector)
      }
      if (selector && (activeSelector !== selector || activeGeneration !== styleGeneration)) {
        styleManager.insert(selector, cssText)
      }
      activeSelector = selector
      activeGeneration = selector ? styleGeneration : -1
    }

    if (!selector) {
      return handle.element
    }

    return renderMixinElement(handle.element, {
      ...props,
      className: props?.className ? `${props.className} ${selector}` : selector,
    })
  }

  function runtime() {
    let current = handle.frame.$runtime as {
      styleCache?: StyleCache
      styleManager?: StyleManagerLike
      styleRoot?: ServerStyleSource
    }
    invariant(current, 'css mixin requires frame runtime')
    if (!current.styleManager && !current.styleCache) {
      current.styleManager = getDefaultStyleManager()
    }
    if (current.styleRoot && current.styleManager) {
      current.styleManager.adoptServerStyles?.(current.styleRoot)
      current.styleRoot = undefined
    }
    return current
  }
}

/**
 * Applies generated class names for CSS object styles.
 */
export const css: MixinFactory<Element, [styles: CSSProps], ElementProps> = createMixin<
  Element,
  [styles: CSSProps],
  ElementProps
>(cssMixinType)

// Detect @keyframes (including vendor-prefixed variants)
function isKeyframesAtRule(key: string): boolean {
  return /^@(?:-(?:webkit|moz|o)-)?keyframes/.test(key.toLowerCase())
}

// Generate a hash for style objects to create unique class names.
// Class names are content-addressed — a collision silently applies the wrong
// styles — so use two independent 32-bit FNV-1a passes (~64 bits of hash
// space) rather than a single 32-bit hash. Must be deterministic across
// server and client. Hashing the style's JSON keeps key order, which affects
// the declarations, and drops undefined properties like client entry props do.
function hashStyle(str: string): string {
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

  if (body) preludeAtRules.push(ruleToCss(selector, body))
  return preludeAtRules.concat(atRules).join('\n')
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
    if (/^[&@:.\[]/.test(key)) {
      // Allow nested rules to be conditionally disabled.
      // e.g. { '&:hover': condition ? undefined : { ... } }
      let rule = isStyleObject(value) ? renderRule?.(key, value) : undefined
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
  return text.replace(/[^\n]+/g, '  $&')
}

// Build the body of a @keyframes rule (without wrapping selector)
function keyframesBodyToCss(frames: StyleObject): string {
  let blocks: string[] = []

  for (let [frameSelector, frameValue] of Object.entries(frames)) {
    // Skip non-object frame definitions and ignore nested selectors/at-rules inside keyframe steps
    if (isStyleObject(frameValue)) {
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

export function processStyleClass(styles: CSSProps, cache: StyleCache): StyleEntry {
  if (Object.keys(styles).length === 0) return { selector: '', css: '' }

  // Key by the serialized styles so a cache hit skips hashing and rule generation.
  let serialized = JSON.stringify(styles)
  let entry = cache.get(serialized)
  if (!entry) {
    let selector = `rmxc-${hashStyle(serialized)}`
    entry = { selector, css: styleToCss(styles, `.${selector}`) }
    cache.set(serialized, entry)
  }
  return entry
}
