export function createStyleManager(layer: string = 'rmx') {
  let stylesheet = new CSSStyleSheet()
  document.adoptedStyleSheets.push(stylesheet)

  // Track usage count and rule index per className
  // Using an object to track both count and index together
  let ruleMap = new Map<string, { count: number; index: number }>()

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
    let index = stylesheet.cssRules.length
    try {
      stylesheet.insertRule(`@layer ${layer} { ${rule} }`, index)
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

    // Delete the rule
    try {
      stylesheet.deleteRule(indexToDelete)
    } catch (error) {
      // Rule might have been deleted externally or index invalid
      // Clean up our tracking anyway
      ruleMap.delete(className)
      return
    }

    // Remove from tracking
    ruleMap.delete(className)

    // Update indices for all rules that came after the deleted one
    // They all shift down by 1
    for (let [name, data] of ruleMap.entries()) {
      if (data.index > indexToDelete) {
        data.index--
      }
    }
  }

  function dispose() {
    // Remove stylesheet from document
    document.adoptedStyleSheets = Array.from(document.adoptedStyleSheets).filter(
      (s) => s !== stylesheet,
    )
    // Clear internal state
    ruleMap.clear()
  }

  return { insert, remove, has, dispose }
}
