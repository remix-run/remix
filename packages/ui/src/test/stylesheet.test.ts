import { describe, it, expect } from 'vitest'
import { createStyleManager } from '../style/stylesheet.ts'

describe('createStyleManager', () => {
  it('does not adopt an empty stylesheet until styles are inserted', () => {
    let before = document.adoptedStyleSheets.length
    let mgr = createStyleManager('rmx-test')

    expect(document.adoptedStyleSheets.length).toBe(before)

    mgr.dispose()
  })

  it('inserts a rule once and increments count on repeat', () => {
    let mgr = createStyleManager('rmx-test')
    mgr.insert('rmx-a', '.rmx-a { color: red; }')
    let sheet = document.adoptedStyleSheets[document.adoptedStyleSheets.length - 1]
    expect(mgr.has('rmx-a')).toBe(true)
    expect(sheet.cssRules.length).toBe(1)

    // Second insert should increment count, not duplicate rule
    mgr.insert('rmx-a', '.rmx-a { color: red; }')
    expect(mgr.has('rmx-a')).toBe(true)
    expect(sheet.cssRules.length).toBe(1) // Still only one rule

    // Verify layer and content
    let cssText = sheet.cssRules[0]?.cssText || ''
    expect(cssText.includes('@layer rmx-test')).toBe(true)
    expect(cssText.includes('.rmx-a')).toBe(true)
    expect(cssText.match(/\n\s+\.rmx-a\s*\{/g)?.length).toBe(1) // Selector rule appears once

    // cleanup
    mgr.dispose()
  })

  it('uses default layer name when not provided', () => {
    let mgr = createStyleManager()
    mgr.insert('rmx-a', '.rmx-a { color: red; }')
    let sheet = document.adoptedStyleSheets[document.adoptedStyleSheets.length - 1]
    let cssText = sheet.cssRules[0]?.cssText || ''
    expect(cssText.includes('@layer rmx')).toBe(true)
    // cleanup
    mgr.dispose()
  })

  it('returns false for has() when class was never inserted', () => {
    let mgr = createStyleManager('rmx-test')
    expect(mgr.has('rmx-never-inserted')).toBe(false)
    mgr.dispose()
  })

  it('safely handles removing a class that was never inserted', () => {
    let mgr = createStyleManager('rmx-test')
    let initialLength = document.adoptedStyleSheets.length

    mgr.remove('rmx-never-inserted')
    expect(document.adoptedStyleSheets.length).toBe(initialLength)
    expect(mgr.has('rmx-never-inserted')).toBe(false)

    // cleanup
    mgr.dispose()
  })

  it('handles multiple managers with different layers independently', () => {
    let before = document.adoptedStyleSheets.length
    let mgr1 = createStyleManager('layer-1')
    let mgr2 = createStyleManager('layer-2')

    mgr1.insert('rmx-a', '.rmx-a { color: red; }')
    mgr2.insert('rmx-a', '.rmx-a { color: blue; }')

    // one client sheet per manager (in insert order)
    let sheet1 = document.adoptedStyleSheets[before]
    let sheet2 = document.adoptedStyleSheets[before + 1]

    expect(sheet1.cssRules.length).toBe(1)
    expect(sheet2.cssRules.length).toBe(1)
    expect(sheet1.cssRules[0]?.cssText).toContain('@layer layer-1.rmx-a')
    expect(sheet2.cssRules[0]?.cssText).toContain('@layer layer-2.rmx-a')

    // cleanup
    mgr1.dispose()
    mgr2.dispose()
  })

  it('handles complex CSS rules with nested selectors and at-rules', () => {
    let mgr = createStyleManager('rmx-test')

    let complexRule = `
      .rmx-complex {
        color: red;
      }
      .rmx-complex:hover {
        color: blue;
      }
      @media (min-width: 768px) {
        .rmx-complex {
          font-size: 16px;
        }
      }
    `
    mgr.insert('rmx-complex', complexRule)

    let sheet = document.adoptedStyleSheets[document.adoptedStyleSheets.length - 1]
    expect(sheet.cssRules.length).toBe(1)
    let cssText = sheet.cssRules[0]?.cssText || ''
    expect(cssText).toContain('.rmx-complex')
    expect(cssText).toContain(':hover')
    expect(cssText).toContain('@media')

    // cleanup
    mgr.dispose()
  })

  it('removes only when count reaches zero and reindexes', () => {
    let mgr = createStyleManager('rmx-test')
    mgr.insert('rmx-a', '.rmx-a { color: red; }')
    mgr.insert('rmx-b', '.rmx-b { color: blue; }')
    mgr.insert('rmx-a', '.rmx-a { color: red; }')
    let sheet = document.adoptedStyleSheets[document.adoptedStyleSheets.length - 1]

    // decrement rmx-a once (still present)
    mgr.remove('rmx-a')
    expect(mgr.has('rmx-a')).toBe(true)
    expect(sheet.cssRules.length).toBe(2)
    expect(sheet.cssRules[0]?.cssText + sheet.cssRules[1]?.cssText).toContain('.rmx-a')
    expect(sheet.cssRules[0]?.cssText + sheet.cssRules[1]?.cssText).toContain('.rmx-b')

    // remove rmx-b fully
    mgr.remove('rmx-b')
    expect(mgr.has('rmx-b')).toBe(false)
    expect(sheet.cssRules.length).toBe(1)
    expect(sheet.cssRules[0]?.cssText).toContain('.rmx-a')

    // remove rmx-a final time
    mgr.remove('rmx-a')
    expect(mgr.has('rmx-a')).toBe(false)
    expect(sheet.cssRules.length).toBe(0)
    // cleanup
    mgr.dispose()
  })

  it('keeps other rules stable when removing from the middle (reindex correctness)', () => {
    let mgr = createStyleManager('rmx-test')

    mgr.insert('rmx-a', '.rmx-a { color: red; }')
    mgr.insert('rmx-b', '.rmx-b { color: blue; }')
    mgr.insert('rmx-c', '.rmx-c { color: green; }')
    let sheet = document.adoptedStyleSheets[document.adoptedStyleSheets.length - 1]
    expect(sheet.cssRules.length).toBe(3)

    // Remove middle
    mgr.remove('rmx-b')
    expect(sheet.cssRules.length).toBe(2)
    let combined = Array.from(sheet.cssRules)
      .map((r) => (r as any).cssText || '')
      .join('\n')
    expect(combined).toContain('.rmx-a')
    expect(combined).toContain('.rmx-c')

    // Now remove rmx-c; should target the correct (shifted) index
    mgr.remove('rmx-c')
    expect(sheet.cssRules.length).toBe(1)
    expect((sheet.cssRules[0] as any).cssText || '').toContain('.rmx-a')

    // cleanup
    mgr.dispose()
  })

  it('styles apply to the DOM while present and stop applying after full removal', () => {
    let mgr = createStyleManager('rmx-test')

    let el = document.createElement('div')
    document.body.appendChild(el)

    mgr.insert('rmx-a', '.rmx-a { color: rgb(255, 0, 0); }')
    el.className = 'rmx-a'
    expect(getComputedStyle(el).color).toBe('rgb(255, 0, 0)')

    // Double insert then remove once -> still styled
    mgr.insert('rmx-a', '.rmx-a { color: rgb(255, 0, 0); }')
    mgr.remove('rmx-a')
    expect(getComputedStyle(el).color).toBe('rgb(255, 0, 0)')

    // Final remove -> rule gone, style should not be red (likely 'rgb(0, 0, 0)' or inherited)
    mgr.remove('rmx-a')
    expect(getComputedStyle(el).color).not.toBe('rgb(255, 0, 0)')

    // cleanup
    document.body.removeChild(el)
    mgr.dispose()
  })

  it('keeps duplicate selectors in their original cascade layer order across managers', () => {
    let mgr1 = createStyleManager('rmx-test')
    let mgr2 = createStyleManager('rmx-test')
    let el = document.createElement('button')
    document.body.appendChild(el)

    mgr1.insert('rmx-base', '.rmx-base { color: rgb(0, 0, 0); }')
    mgr1.insert('rmx-danger', '.rmx-danger { color: rgb(255, 0, 0); }')
    mgr2.insert('rmx-base', '.rmx-base { color: rgb(0, 0, 0); }')

    el.className = 'rmx-base rmx-danger'
    expect(getComputedStyle(el).color).toBe('rgb(255, 0, 0)')

    document.body.removeChild(el)
    mgr1.dispose()
    mgr2.dispose()
  })

  it('adopts server-rendered style tag', () => {
    // Simulate server-rendered style tag
    let serverStyle = document.createElement('style')
    serverStyle.setAttribute('data-rmx', 'rmxc-server1')
    serverStyle.textContent = '@layer rmx { .rmxc-server1 { color: blue; } }'
    document.head.appendChild(serverStyle)
    expect(document.querySelector('style[data-rmx]')).not.toBeNull()

    // Create manager and adopt server styles for its frame
    let mgr = createStyleManager('rmx')
    mgr.adoptServerStyles(document)

    // Tag should be removed after adoption
    expect(document.querySelector('style[data-rmx]')).toBeNull()

    // Server-rendered selector should be recognized as existing (count: 1)
    expect(mgr.has('rmxc-server1')).toBe(true)

    // Inserting the same selector should increment count from 1 to 2
    mgr.insert('rmxc-server1', '.rmxc-server1 { color: blue; }')
    expect(mgr.has('rmxc-server1')).toBe(true)

    // Ensure the adopted stylesheet content exists in constructed sheets
    let hasAdoptedRule = Array.from(document.adoptedStyleSheets).some((sheet) => {
      let text = Array.from(sheet.cssRules)
        .map((r) => (r as any).cssText || '')
        .join('\n')
      return text.includes('rmxc-server1')
    })
    expect(hasAdoptedRule).toBe(true)

    // First remove decrements count from 2 to 1, still exists
    mgr.remove('rmxc-server1')
    expect(mgr.has('rmxc-server1')).toBe(true)

    // Second remove decrements count from 1 to 0, no longer tracked
    // (rule stays in the shared server stylesheet, but ruleMap entry is removed)
    mgr.remove('rmxc-server1')
    expect(mgr.has('rmxc-server1')).toBe(false)

    // cleanup
    mgr.dispose()
  })

  it('adopts server style tags added after manager creation', () => {
    let mgr = createStyleManager('rmx')

    let streamedStyle = document.createElement('style')
    streamedStyle.setAttribute('data-rmx', 'rmxc-stream1')
    streamedStyle.textContent = '@layer rmx { .rmxc-stream1 { color: green; } }'
    document.head.appendChild(streamedStyle)

    mgr.adoptServerStyles(document)

    expect(document.querySelector('style[data-rmx]')).toBeNull()
    expect(mgr.has('rmxc-stream1')).toBe(true)

    mgr.dispose()
  })

  it('deduplicates streamed server style tags by selector identity', () => {
    let mgr = createStyleManager('rmx')

    function appendStreamedStyle() {
      let streamedStyle = document.createElement('style')
      streamedStyle.setAttribute('data-rmx', 'rmxc-stream1')
      streamedStyle.textContent = '@layer rmx { .rmxc-stream1 { color: green; } }'
      document.head.appendChild(streamedStyle)
    }

    function countRules(selector: string): number {
      return Array.from(document.adoptedStyleSheets).reduce((count, sheet) => {
        let matches = Array.from(sheet.cssRules).filter((rule) =>
          ((rule as any).cssText as string | undefined)?.includes(selector),
        )
        return count + matches.length
      }, 0)
    }

    appendStreamedStyle()
    mgr.adoptServerStyles(document)
    expect(countRules('rmxc-stream1')).toBe(1)

    appendStreamedStyle()
    mgr.adoptServerStyles(document)

    expect(document.querySelectorAll('style[data-rmx="rmxc-stream1"]')).toHaveLength(0)
    expect(countRules('rmxc-stream1')).toBe(1)
    expect(mgr.has('rmxc-stream1')).toBe(true)

    mgr.dispose()
  })

  it('adopts server style tags in document order', () => {
    let mgr = createStyleManager('rmx')
    let container = document.createElement('div')

    for (let selector of ['rmxc-base', 'rmxc-trigger', 'rmxc-user']) {
      let style = document.createElement('style')
      style.setAttribute('data-rmx', selector)
      style.textContent = `@layer rmx { .${selector} { color: red; } }`
      container.appendChild(style)
    }

    document.body.appendChild(container)
    mgr.adoptServerStyles([container])

    let sheet = document.adoptedStyleSheets[document.adoptedStyleSheets.length - 1]
    let cssText = Array.from(sheet.cssRules)
      .map((rule) => rule.cssText)
      .join('\n')

    expect(cssText.indexOf('.rmxc-base')).toBeLessThan(cssText.indexOf('.rmxc-trigger'))
    expect(cssText.indexOf('.rmxc-trigger')).toBeLessThan(cssText.indexOf('.rmxc-user'))
    expect(container.querySelector('style[data-rmx]')).toBeNull()

    container.remove()
    mgr.dispose()
  })

  it('removes the adopted stylesheet when reset leaves the manager empty', () => {
    let before = document.adoptedStyleSheets.length
    let mgr = createStyleManager('rmx-test')

    mgr.insert('rmx-a', '.rmx-a { color: red; }')
    expect(document.adoptedStyleSheets.length).toBe(before + 1)

    mgr.reset()
    expect(document.adoptedStyleSheets.length).toBe(before)
    expect(mgr.has('rmx-a')).toBe(false)

    mgr.dispose()
  })

  it('tracks manager generations when stylesheet state is cleared', () => {
    let mgr = createStyleManager('rmx-test')
    let initialGeneration = mgr.getGeneration()

    mgr.insert('rmx-a', '.rmx-a { color: red; }')
    expect(mgr.getGeneration()).toBe(initialGeneration)

    mgr.reset()
    expect(mgr.getGeneration()).toBe(initialGeneration + 1)

    mgr.dispose()
    expect(mgr.getGeneration()).toBe(initialGeneration + 2)
  })
})
