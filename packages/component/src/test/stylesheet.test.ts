import { describe, it, expect } from 'vitest'
import { createStyleManager } from '../lib/style/lib/stylesheet.ts'

describe('createStyleManager', () => {
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
    expect(cssText.split('.rmx-a').length - 1).toBe(1) // Class appears once

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
    let sheet = document.adoptedStyleSheets[document.adoptedStyleSheets.length - 1]
    let initialLength = sheet.cssRules.length

    mgr.remove('rmx-never-inserted')
    expect(sheet.cssRules.length).toBe(initialLength)
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

    // one server sheet, then one client sheet per manager (in insert order)
    let sheet1 = document.adoptedStyleSheets[before + 1]
    let sheet2 = document.adoptedStyleSheets[before + 2]

    expect(sheet1.cssRules.length).toBe(1)
    expect(sheet2.cssRules.length).toBe(1)
    expect(sheet1.cssRules[0]?.cssText).toContain('@layer layer-1')
    expect(sheet2.cssRules[0]?.cssText).toContain('@layer layer-2')

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
    let sheet = document.adoptedStyleSheets[document.adoptedStyleSheets.length - 1]
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

  it('adopts server-rendered style tag', () => {
    // Simulate server-rendered style tag
    let serverStyle = document.createElement('style')
    serverStyle.setAttribute('data-rmx-styles', '')
    serverStyle.textContent = '@layer rmx { [data-css="rmx-server1"] { color: blue; } }'
    document.head.appendChild(serverStyle)
    expect(document.querySelector('style[data-rmx-styles]')).not.toBeNull()

    // Create manager which should detect and adopt the server styles
    let mgr = createStyleManager('rmx')

    // Tag should be removed after adoption
    expect(document.querySelector('style[data-rmx-styles]')).toBeNull()

    // Server-rendered selector should be recognized as existing (count: 1)
    expect(mgr.has('rmx-server1')).toBe(true)

    // Inserting the same selector should increment count from 1 to 2
    mgr.insert('rmx-server1', '[data-css="rmx-server1"] { color: blue; }')
    expect(mgr.has('rmx-server1')).toBe(true)

    // Ensure the adopted stylesheet content exists in constructed sheets
    let hasAdoptedRule = Array.from(document.adoptedStyleSheets).some((sheet) => {
      let text = Array.from(sheet.cssRules)
        .map((r) => (r as any).cssText || '')
        .join('\n')
      return text.includes('rmx-server1')
    })
    expect(hasAdoptedRule).toBe(true)

    // First remove decrements count from 2 to 1, still exists
    mgr.remove('rmx-server1')
    expect(mgr.has('rmx-server1')).toBe(true)

    // Second remove decrements count from 1 to 0, no longer tracked
    // (rule stays in the shared server stylesheet, but ruleMap entry is removed)
    mgr.remove('rmx-server1')
    expect(mgr.has('rmx-server1')).toBe(false)

    // cleanup
    mgr.dispose()
  })

  it('adopts and removes streamed server style tags added after manager creation', async () => {
    let mgr = createStyleManager('rmx')

    let streamedStyle = document.createElement('style')
    streamedStyle.setAttribute('data-rmx-styles', '')
    streamedStyle.textContent = '@layer rmx { [data-css="rmx-stream1"] { color: green; } }'
    document.head.appendChild(streamedStyle)

    // MutationObserver runs on a microtask; wait a tick
    await new Promise((r) => setTimeout(r, 0))

    expect(document.querySelector('style[data-rmx-styles]')).toBeNull()
    expect(mgr.has('rmx-stream1')).toBe(true)

    mgr.dispose()
  })
})
