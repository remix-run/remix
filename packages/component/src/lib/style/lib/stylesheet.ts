export function createStyleManager(layer: string = 'rmx') {
  let stylesheet = new CSSStyleSheet()
  document.adoptedStyleSheets.push(stylesheet)

  // Track usage count per className
  let counts = new Map<string, number>()
  let inserted = new Set<string>()

  function has(className: string) {
    return counts.has(className)
  }

  function insert(className: string, rule: string) {
    if (inserted.has(className)) return
    inserted.add(className)
    // let current = counts.get(className) || 0
    // if (current > 0) {
    //   counts.set(className, current + 1)
    //   return
    // }
    stylesheet.insertRule(`@layer ${layer} { ${rule} }`)
    // counts.set(className, 1)
  }

  // DEBUGGING - so no removals right now
  function remove(className: string) {
    // let current = counts.get(className)
    // if (!current) return
    // if (current > 1) {
    //   counts.set(className, current - 1)
    //   return
    // }
    // // fully remove
    // counts.delete(className)
    // // find the rule index containing this class and delete it
    // for (let i = 0; i < stylesheet.cssRules.length; i++) {
    //   let text = (stylesheet.cssRules[i] as any).cssText || ''
    //   if (text.includes(`.${className}`)) {
    //     stylesheet.deleteRule(i)
    //     break
    //   }
    // }
  }

  return { insert, remove, has }
}

/*
let manager = createStyleManager()
manager.insert("rmx-123", ".rmx-123 { color: red; }")
manager.remove("rmx-123")
*/
