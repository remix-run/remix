import { REMIX_UI_STYLE_LAYER } from './layers.ts'

type RuleEntry = { count: number; index: number }
type ServerStyleSource = ParentNode | Iterable<Node>

const SERVER_STYLE_SELECTOR = 'style[data-rmx]'

function getStyleLayerName(className: string, layer: string = REMIX_UI_STYLE_LAYER): string {
  return `${layer}.${className}`
}

function compareNodesInDocumentOrder(a: Node, b: Node): number {
  if (a === b) return 0

  let position = a.compareDocumentPosition(b)
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1
  return 0
}

function isParentNode(value: ServerStyleSource): value is ParentNode {
  return 'querySelectorAll' in value
}

function collectServerStyleTagsFromNode(node: Node, into: Set<HTMLStyleElement>): void {
  if (isHtmlStyleElement(node) && node.matches(SERVER_STYLE_SELECTOR)) {
    into.add(node)
    return
  }

  if (
    !(node instanceof Element) &&
    !(node instanceof Document) &&
    !(node instanceof DocumentFragment)
  ) {
    return
  }

  let nested = node.querySelectorAll?.(SERVER_STYLE_SELECTOR) ?? []
  for (let i = 0; i < nested.length; i++) {
    let el = nested[i]
    if (isHtmlStyleElement(el)) {
      into.add(el)
    }
  }
}

function collectServerStyleTags(source: ServerStyleSource): HTMLStyleElement[] {
  let styles = new Set<HTMLStyleElement>()

  if (isParentNode(source)) {
    collectServerStyleTagsFromNode(source as unknown as Node, styles)
  } else {
    for (let node of source) {
      collectServerStyleTagsFromNode(node, styles)
    }
  }

  return Array.from(styles).sort(compareNodesInDocumentOrder)
}

function isHtmlStyleElement(node: unknown): node is HTMLStyleElement {
  return typeof node === 'object' && node !== null && node instanceof HTMLStyleElement
}

function getStyleSelector(styleEl: HTMLStyleElement): string | null {
  let selector = styleEl.getAttribute('data-rmx')?.trim()
  return selector ? selector : null
}

export function createStyleManager(layer: string = REMIX_UI_STYLE_LAYER) {
  let stylesheet: CSSStyleSheet | null = null
  let generation = 0

  // Track usage count and rule index per className
  // Using an object to track both count and index together
  let ruleMap = new Map<string, RuleEntry>()

  // Selectors currently held by a server-style adoption ref. We track this
  // separately from `ruleMap` so `replaceServerStyles` can release only the
  // adoption refs of selectors absent from the next page, without disturbing
  // selectors that exist solely because a client-side css mixin inserted them
  // (e.g. transient UI state that the server never rendered).
  let adoptedSelectors = new Set<string>()

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

  function clearStylesheet() {
    if (!stylesheet) return
    for (let i = stylesheet.cssRules.length - 1; i >= 0; i--) {
      stylesheet.deleteRule(i)
    }
  }

  function adoptServerStyleTag(styleEl: HTMLStyleElement): string | undefined {
    let selector = getStyleSelector(styleEl)
    if (!selector) return undefined

    if (ruleMap.has(selector)) {
      // Already tracked. Take an adoption ref if we don't already have one —
      // the rule may have been inserted by a client-side css mixin first and
      // the SSR'd style tag arrived afterwards (e.g. a streamed fragment).
      if (!adoptedSelectors.has(selector)) {
        let entry = ruleMap.get(selector)!
        entry.count++
        adoptedSelectors.add(selector)
      }
      styleEl.remove()
      return selector
    }

    let cssText = styleEl.textContent?.trim() ?? ''
    if (cssText.length === 0) {
      styleEl.remove()
      return undefined
    }

    try {
      let sheet = getStylesheet()
      let index = sheet.cssRules.length
      sheet.insertRule(cssText, index)
      ruleMap.set(selector, { count: 1, index })
      adoptedSelectors.add(selector)
      styleEl.remove()
      return selector
    } catch {
      // If adoption fails, keep the <style> tag in the DOM so styles still apply.
      return undefined
    }
  }

  function has(className: string) {
    let entry = ruleMap.get(className)
    return entry !== undefined && entry.count > 0
  }

  function getGeneration() {
    return generation
  }

  function insert(className: string, rule: string) {
    let entry = ruleMap.get(className)

    if (entry) {
      // Already exists, just increment count
      entry.count++
      return
    }

    // New rule - insert and track
    let sheet = getStylesheet()
    let index = sheet.cssRules.length
    // This may throw for invalid CSS. If it does, we intentionally let it
    // bubble so the rule is not tracked unless insertion actually succeeds.
    sheet.insertRule(`@layer ${getStyleLayerName(className, layer)} { ${rule} }`, index)
    ruleMap.set(className, { count: 1, index })
  }

  function remove(className: string) {
    let entry = ruleMap.get(className)

    if (!entry) return

    // Decrement count
    entry.count--

    if (entry.count > 0) {
      // Still in use, keep the rule
      return
    }

    // Count reached zero, remove the rule
    let indexToDelete = entry.index

    // Remove from tracking
    ruleMap.delete(className)
    adoptedSelectors.delete(className)

    // TODO: just search and remove, stop re-indexing
    if (!stylesheet) return
    stylesheet.deleteRule(indexToDelete)

    // Update indices for all rules that came after the deleted one
    // They all shift down by 1
    for (let [, data] of ruleMap.entries()) {
      if (data.index > indexToDelete) {
        data.index--
      }
    }
  }

  function reset() {
    clearStylesheet()
    ruleMap.clear()
    adoptedSelectors.clear()
    removeStylesheet()
    generation++
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

  // Snapshot the currently-adopted server selectors, adopt the incoming
  // server styles additively, then release the adoption ref of any prior-only
  // selectors.
  //
  // Refcount-aware semantics keep preserved DOM styled: a prior-only selector
  // with no live css-mixin ref drops immediately, but one still referenced by
  // an active mixin (e.g. inside a hydration region that the DOM diff skipped)
  // stays in the stylesheet and is only fully removed when that mixin's
  // `remove` event eventually fires. This avoids the FOUC that a hard
  // `reset()` would cause between the style swap and the hydration re-render.
  //
  // Only adoption refs are considered — selectors that exist solely because a
  // client-side css mixin inserted them (e.g. transient UI state never
  // rendered by the server) are unaffected.
  function replaceServerStyles(source: ServerStyleSource): void {
    let prior = new Set(adoptedSelectors)
    let adopted = adoptServerStyles(source)
    for (let selector of prior) {
      if (!adopted.has(selector)) {
        adoptedSelectors.delete(selector)
        remove(selector)
      }
    }
  }

  function selectors(): IterableIterator<string> {
    return ruleMap.keys()
  }

  function dispose() {
    removeStylesheet()
    // Clear internal state
    ruleMap.clear()
    adoptedSelectors.clear()
    generation++
  }

  return {
    insert,
    remove,
    has,
    getGeneration,
    reset,
    adoptServerStyles,
    replaceServerStyles,
    selectors,
    dispose,
  }
}
