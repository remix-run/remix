import { REMIX_UI_STYLE_LAYER } from './layers.ts'

// # Style ownership model
//
// Rules are content-addressed: a class name is a hash of the style object that
// produced it, so `.rmxc-x` always means the same declarations. A rule can
// never become *wrong* — only unused. That observation drives a two-tier
// lifetime model on a single document-level registry:
//
// - **Server-adopted rules are pinned.** Once a `<style data-rmx>` tag is
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

type RuleEntry = { count: number; index: number; pinned: boolean }
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

export function createStyleManager(layer: string = REMIX_UI_STYLE_LAYER): StyleManager {
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

  function clearStylesheet() {
    if (!stylesheet) return
    for (let i = stylesheet.cssRules.length - 1; i >= 0; i--) {
      stylesheet.deleteRule(i)
    }
  }

  function adoptServerStyleTag(styleEl: HTMLStyleElement): string | undefined {
    let selector = getStyleSelector(styleEl)
    if (!selector) return undefined

    let entry = ruleMap.get(selector)
    if (entry) {
      // The rule already exists — either a previous adoption or a client-side
      // css mixin inserted it first. Pin it so it outlives any mixin refs.
      entry.pinned = true
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
      ruleMap.set(selector, { count: 0, index, pinned: true })
      styleEl.remove()
      return selector
    } catch {
      // If adoption fails, keep the <style> tag in the DOM so styles still apply.
      return undefined
    }
  }

  function has(className: string) {
    let entry = ruleMap.get(className)
    return entry !== undefined && (entry.pinned || entry.count > 0)
  }

  function getGeneration() {
    return generation
  }

  function insert(className: string, rule: string) {
    let entry = ruleMap.get(className)

    if (entry) {
      // Pinned rules are permanent; there is nothing to count.
      if (!entry.pinned) entry.count++
      return
    }

    // New rule - insert and track
    let sheet = getStylesheet()
    let index = sheet.cssRules.length
    // This may throw for invalid CSS. If it does, we intentionally let it
    // bubble so the rule is not tracked unless insertion actually succeeds.
    sheet.insertRule(`@layer ${getStyleLayerName(className, layer)} { ${rule} }`, index)
    ruleMap.set(className, { count: 1, index, pinned: false })
  }

  function remove(className: string) {
    let entry = ruleMap.get(className)

    if (!entry || entry.pinned) return

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
