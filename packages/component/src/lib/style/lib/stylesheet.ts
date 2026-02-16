// .rmx-23ace { color: red; }
// <ul>{item.map(() => <li css={{ color: 'red' }}>)}

type RuleEntry = { count: number; index: number }
type ActiveManager = { layer: string; ruleMap: Map<string, RuleEntry> }

type ServerStyleState = {
  sheet: CSSStyleSheet
  text: string
  refCount: number
  observer: MutationObserver | null
  processed: WeakSet<HTMLStyleElement>
  adoptedTexts: Set<string>
  selectorsByLayer: Map<string, Set<string>>
}

let serverStyleState: ServerStyleState | null = null
let activeManagers = new Set<ActiveManager>()

function isHtmlStyleElement(node: unknown): node is HTMLStyleElement {
  return typeof node === 'object' && node !== null && node instanceof HTMLStyleElement
}

function getLayerName(rule: CSSRule): string | null {
  if (typeof (globalThis as any).CSSLayerBlockRule === 'undefined') return null
  if (!(rule instanceof (globalThis as any).CSSLayerBlockRule)) return null
  // CSSLayerBlockRule.name exists in modern browsers, but it's not always in TS DOM libs
  return ((rule as any).name as string | undefined) ?? null
}

function isCssStyleRule(rule: CSSRule): rule is CSSStyleRule {
  if (typeof (globalThis as any).CSSStyleRule === 'undefined') return false
  return rule instanceof (globalThis as any).CSSStyleRule
}

function walkRulesForSelectors(
  rules: CSSRuleList,
  layerName: string | null,
  addSelector: (layerName: string, selector: string) => void,
) {
  for (let i = 0; i < rules.length; i++) {
    let rule = rules[i]
    if (!rule) continue

    let nextLayerName = getLayerName(rule) ?? layerName

    if (isCssStyleRule(rule)) {
      if (!nextLayerName) continue
      // Extract selectors like [data-css="rmx-abc123"] (supports multiple selectors)
      let matches = rule.selectorText.matchAll(/\[data-css="([^"]+)"\]/g)
      for (let match of matches) {
        let selector = match[1]
        if (selector) addSelector(nextLayerName, selector)
      }
      continue
    }

    // Recurse through grouping rules (@media, @supports, @layer, etc.)
    let childRules = (rule as any).cssRules as CSSRuleList | undefined
    if (childRules) {
      walkRulesForSelectors(childRules, nextLayerName, addSelector)
    }
  }
}

function seedManagersWithServerSelectors(layerName: string, selectors: Set<string>) {
  for (let mgr of activeManagers) {
    if (mgr.layer !== layerName) continue
    for (let selector of selectors) {
      if (!mgr.ruleMap.has(selector)) {
        // Track as existing (count: 1, index: -1 since it's in the shared server stylesheet)
        mgr.ruleMap.set(selector, { count: 1, index: -1 })
      }
    }
  }
}

function ensureServerStyleState(): ServerStyleState {
  if (serverStyleState) return serverStyleState

  let sheet = new CSSStyleSheet()
  document.adoptedStyleSheets.push(sheet)

  serverStyleState = {
    sheet,
    text: '',
    refCount: 0,
    observer: null,
    processed: new WeakSet(),
    adoptedTexts: new Set(),
    selectorsByLayer: new Map(),
  }

  adoptAllServerStyleTags()
  startServerStyleObserver()

  return serverStyleState
}

function adoptAllServerStyleTags() {
  if (!serverStyleState) return

  let styles = document.querySelectorAll('style[data-rmx-styles]')
  for (let i = 0; i < styles.length; i++) {
    let el = styles[i]
    if (isHtmlStyleElement(el)) adoptServerStyleTag(el)
  }
}

function startServerStyleObserver() {
  if (!serverStyleState) return
  if (serverStyleState.observer) return

  // Adopt streamed chunks that include their own <style data-rmx-styles> tags.
  // We watch the whole document so templates inserted into <body> are covered too.
  let root = document.documentElement
  if (!root) return

  serverStyleState.observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      for (let node of mutation.addedNodes) {
        if (!node) continue
        if (isHtmlStyleElement(node)) {
          if (node.matches('style[data-rmx-styles]')) adoptServerStyleTag(node)
          continue
        }
        if (node instanceof Element) {
          let nested = node.querySelectorAll?.('style[data-rmx-styles]') ?? []
          for (let i = 0; i < nested.length; i++) {
            let el = nested[i]
            if (isHtmlStyleElement(el)) adoptServerStyleTag(el)
          }
        }
      }
    }
  })

  serverStyleState.observer.observe(root, { childList: true, subtree: true })
}

function adoptServerStyleTag(styleEl: HTMLStyleElement) {
  if (!serverStyleState) return
  if (serverStyleState.processed.has(styleEl)) return
  serverStyleState.processed.add(styleEl)

  let addedSelectorsByLayer = new Map<string, Set<string>>()
  function addSelector(layerName: string, selector: string) {
    let layerSet = serverStyleState!.selectorsByLayer.get(layerName)
    if (!layerSet) {
      layerSet = new Set()
      serverStyleState!.selectorsByLayer.set(layerName, layerSet)
    }
    if (layerSet.has(selector)) return
    layerSet.add(selector)

    let addedSet = addedSelectorsByLayer.get(layerName)
    if (!addedSet) {
      addedSet = new Set()
      addedSelectorsByLayer.set(layerName, addedSet)
    }
    addedSet.add(selector)
  }

  try {
    if (styleEl.sheet) {
      walkRulesForSelectors(styleEl.sheet.cssRules, null, addSelector)
    }
  } catch {
    // If CSSOM access fails, we still adopt the CSS text below.
  }

  let adopted = false
  let cssText = styleEl.textContent?.trim() ?? ''
  if (cssText.length === 0) {
    adopted = true
  } else if (serverStyleState.adoptedTexts.has(cssText)) {
    // Duplicate chunk - safe to remove the tag
    adopted = true
  } else {
    try {
      if (typeof (serverStyleState.sheet as any).replaceSync === 'function') {
        serverStyleState.text += (serverStyleState.text ? '\n' : '') + cssText
        ;(serverStyleState.sheet as any).replaceSync(serverStyleState.text)
        serverStyleState.adoptedTexts.add(cssText)
        adopted = true
      } else if (styleEl.sheet) {
        let rules = styleEl.sheet.cssRules
        for (let i = 0; i < rules.length; i++) {
          let rule = rules[i]
          serverStyleState.sheet.insertRule(rule.cssText, serverStyleState.sheet.cssRules.length)
        }
        serverStyleState.adoptedTexts.add(cssText)
        adopted = true
      }
    } catch {
      // If adoption fails (e.g. invalid CSS), keep the <style> tag in the DOM so styles
      // still apply. We'll still seed selectors so the client won't duplicate rules.
    }
  }

  // Remove the server-rendered <style> tag now that we've adopted its content.
  if (adopted) {
    styleEl.remove()
  }

  // Ensure existing managers treat these as pre-existing rules.
  for (let [layerName, selectors] of addedSelectorsByLayer) {
    seedManagersWithServerSelectors(layerName, selectors)
  }
}

function teardownServerStyleStateIfUnused() {
  if (!serverStyleState) return
  if (serverStyleState.refCount > 0) return

  if (serverStyleState.observer) {
    serverStyleState.observer.disconnect()
  }

  document.adoptedStyleSheets = Array.from(document.adoptedStyleSheets).filter(
    (s) => s !== serverStyleState!.sheet,
  )

  serverStyleState = null
}

export function createStyleManager(layer: string = 'rmx') {
  let server = ensureServerStyleState()
  server.refCount++
  adoptAllServerStyleTags()

  let stylesheet: CSSStyleSheet | null = null
  function getStylesheet(): CSSStyleSheet {
    if (!stylesheet) {
      stylesheet = new CSSStyleSheet()
      document.adoptedStyleSheets.push(stylesheet)
    }
    return stylesheet
  }

  // Track usage count and rule index per className
  // Using an object to track both count and index together
  let ruleMap = new Map<string, RuleEntry>()

  // Seed from any already-adopted server selectors for this layer
  let serverSelectors = server.selectorsByLayer.get(layer)
  if (serverSelectors) {
    for (let selector of serverSelectors) {
      ruleMap.set(selector, { count: 1, index: -1 })
    }
  }

  let manager: ActiveManager = { layer, ruleMap }
  activeManagers.add(manager)

  function has(className: string) {
    let entry = ruleMap.get(className)
    return entry !== undefined && entry.count > 0
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
    try {
      sheet.insertRule(`@layer ${layer} { ${rule} }`, index)
      ruleMap.set(className, { count: 1, index })
    } catch (error) {
      // If insertion fails (e.g., invalid CSS), don't track it
      // The browser will have thrown, so we can't proceed
      throw error
    }
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

    // Server-rendered rules (index: -1) live in the shared server stylesheet, nothing to delete
    if (indexToDelete < 0) return

    // If we somehow don't have a sheet, there's nothing to delete
    if (!stylesheet) return

    // TODO: just search and remove, stop re-indexing
    stylesheet.deleteRule(indexToDelete)

    // Update indices for all rules that came after the deleted one
    // They all shift down by 1
    for (let [name, data] of ruleMap.entries()) {
      if (data.index > indexToDelete) {
        data.index--
      }
    }
  }

  function dispose() {
    if (stylesheet) {
      // Remove stylesheet from document
      document.adoptedStyleSheets = Array.from(document.adoptedStyleSheets).filter(
        (s) => s !== stylesheet,
      )
    }
    // Clear internal state
    ruleMap.clear()
    activeManagers.delete(manager)
    server.refCount--
    teardownServerStyleStateIfUnused()
  }

  return { insert, remove, has, dispose }
}
