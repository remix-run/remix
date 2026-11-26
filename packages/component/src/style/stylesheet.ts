import { normalizeCssValue } from '../runtime/vdom.ts'

// # Style ownership model
//
// Rules are content-addressed: a class name is a hash of the style object that
// produced it, so `.rmxc-x` always means the same declarations. A rule can
// never become *wrong* — only unused. That observation drives a two-tier
// lifetime model on a single document-level registry:
//
// - **Server-adopted rules are pinned.** Once a `<style data-rmx-style>` tag is
//   adopted, its rule stays for the life of the manager. Frame reloads,
//   island hydration, and streamed templates never need to agree on which
//   scope "owns" a shared rule — adoption is additive and idempotent, and the
//   registry is bounded by the set of unique style objects the server ever
//   renders, not by render count.
//
// - **Client-inserted rules are refcounted.** Dynamic style objects (e.g.
//   interpolated values) mint a new class per distinct value, so rules that
//   only ever existed client-side are dropped when the last css mixin using
//   them releases its ref. A refcounted rule upgrades to pinned if a server
//   tag for the same selector is adopted later.

type RuleEntry = { count: number; index: number }
export type ServerStyleSource = ParentNode | Iterable<Node>

export interface StyleManager {
  insert(className: string, rule: string): void
  remove(className: string): void
  has(className: string): boolean
  getGeneration(): number
  reset(): void
  adoptServerStyles(source: ServerStyleSource): Set<string>
  selectors(): IterableIterator<string>
  dispose(): void
}

export const REMIX_UI_STYLE_LAYER = 'rmx'

const SERVER_STYLE_SELECTOR = 'style[data-rmx-style]'

function collectServerStyleTags(source: ServerStyleSource): HTMLStyleElement[] {
  let styles = new Set<HTMLStyleElement>()
  let roots = 'querySelectorAll' in source ? [source] : source
  for (let node of roots) {
    if (node instanceof HTMLStyleElement && node.matches(SERVER_STYLE_SELECTOR)) {
      styles.add(node)
    } else if ('querySelectorAll' in node && typeof node.querySelectorAll === 'function') {
      for (let element of node.querySelectorAll(SERVER_STYLE_SELECTOR)) {
        if (element instanceof HTMLStyleElement) styles.add(element)
      }
    }
  }
  return Array.from(styles).sort((a, b) => {
    let position = a.compareDocumentPosition(b)
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1
    return position & Node.DOCUMENT_POSITION_PRECEDING ? 1 : 0
  })
}

export function createStyleManager(): StyleManager {
  let stylesheet: CSSStyleSheet | null = null
  let generation = 0

  let ruleMap = new Map<string, RuleEntry>()

  function getStylesheet(): CSSStyleSheet {
    if (!stylesheet) {
      stylesheet = new CSSStyleSheet()
      document.adoptedStyleSheets.push(stylesheet)
    }
    return stylesheet
  }

  function removeStylesheet() {
    if (!stylesheet) return
    document.adoptedStyleSheets = Array.from(document.adoptedStyleSheets).filter(
      (s) => s !== stylesheet,
    )
    stylesheet = null
  }

  function addRule(className: string, css: string, count: number) {
    let sheet = getStylesheet()
    let index = sheet.cssRules.length
    sheet.insertRule(css, index)
    ruleMap.set(className, { index, count })
  }

  function adoptServerStyleTag(styleEl: HTMLStyleElement): string | undefined {
    let selector = styleEl.getAttribute('data-rmx-style')?.trim()
    if (!selector) return undefined

    // Only the active document can authorize these styles under its CSP.
    // Detached and CSP-blocked tags have no associated stylesheet.
    if (!styleEl.isConnected || styleEl.ownerDocument !== document || !styleEl.sheet) {
      return undefined
    }

    let entry = ruleMap.get(selector)
    if (entry) {
      entry.count = Infinity
    } else {
      let css = styleEl.textContent.trim()
      if (!css) {
        styleEl.remove()
        return undefined
      }
      try {
        addRule(selector, css, Infinity)
      } catch {
        // Leave the server tag in place if the browser rejects its rule.
        return undefined
      }
    }
    styleEl.remove()
    return selector
  }

  function has(className: string) {
    return ruleMap.has(className)
  }

  function getGeneration() {
    return generation
  }

  function insert(className: string, rule: string) {
    let entry = ruleMap.get(className)
    if (entry) {
      entry.count++
    } else {
      addRule(className, `@layer ${REMIX_UI_STYLE_LAYER}.${className} { ${rule} }`, 1)
    }
  }

  function remove(className: string) {
    let entry = ruleMap.get(className)
    // Server-adopted rules have an infinite reference count.
    if (!entry || --entry.count > 0) return
    ruleMap.delete(className)
    stylesheet?.deleteRule(entry.index)
    for (let data of ruleMap.values()) {
      if (data.index > entry.index) data.index--
    }
  }

  function reset() {
    stylesheet?.replaceSync('')
    dispose()
  }

  function adoptServerStyles(source: ServerStyleSource): Set<string> {
    let styles = collectServerStyleTags(source)
    let adopted = new Set<string>()

    for (let styleEl of styles) {
      let selector = adoptServerStyleTag(styleEl)
      if (selector) adopted.add(selector)
    }

    return adopted
  }

  function selectors(): IterableIterator<string> {
    return ruleMap.keys()
  }

  function dispose() {
    removeStylesheet()
    // Clear internal state
    ruleMap.clear()
    generation++
  }

  return {
    insert,
    remove,
    has,
    getGeneration,
    reset,
    adoptServerStyles,
    selectors,
    dispose,
  }
}

let defaultStyleManager: StyleManager | undefined

export function getDefaultStyleManager(): StyleManager {
  return (defaultStyleManager ??= createStyleManager())
}

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

const camelToKebabCache = new Map<string, string>()

export function camelToKebab(str: string): string {
  if (str.startsWith('--')) return str
  let cached = camelToKebabCache.get(str)
  if (cached === undefined) {
    cached = str
      .replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
      .replace(/^(webkit|moz|ms|o)-/, '-$1-')
    if (camelToKebabCache.size >= 256) {
      let oldest = camelToKebabCache.keys().next()
      if (!oldest.done) camelToKebabCache.delete(oldest.value)
    }
    camelToKebabCache.set(str, cached)
  }
  return cached
}

export function serializeStyleObject(style: Record<string, unknown>): string {
  let out = ''
  for (let key in style) {
    if (!Object.hasOwn(style, key)) continue
    let value = style[key]
    if (value == null || typeof value === 'boolean') continue
    let cssValue: string | undefined
    if (typeof value === 'string') {
      cssValue = value
    } else if (Array.isArray(value)) {
      cssValue = value.join(', ')
    } else {
      cssValue = normalizeCssValue(key, value)
    }
    if (cssValue !== undefined) {
      out += (out ? ' ' : '') + camelToKebab(key) + ': ' + cssValue + ';'
    }
  }
  return out
}
