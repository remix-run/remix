import { describe, it, expect } from 'vitest'
import { createStyleManager } from './stylesheet.ts'

describe('createStyleManager', () => {
  it('inserts a rule once and increments count on repeat', () => {
    let before = document.adoptedStyleSheets.length
    let mgr = createStyleManager('rmx-test')
    let sheet = document.adoptedStyleSheets[before]
    mgr.insert('rmx-a', '.rmx-a { color: red; }')
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
    let before = document.adoptedStyleSheets.length
    let mgr = createStyleManager()
    let sheet = document.adoptedStyleSheets[before]
    mgr.insert('rmx-a', '.rmx-a { color: red; }')
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
    let before = document.adoptedStyleSheets.length
    let mgr = createStyleManager('rmx-test')
    let sheet = document.adoptedStyleSheets[before]
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
    let sheet1 = document.adoptedStyleSheets[before]
    let sheet2 = document.adoptedStyleSheets[before + 1]

    mgr1.insert('rmx-a', '.rmx-a { color: red; }')
    mgr2.insert('rmx-a', '.rmx-a { color: blue; }')

    expect(sheet1.cssRules.length).toBe(1)
    expect(sheet2.cssRules.length).toBe(1)
    expect(sheet1.cssRules[0]?.cssText).toContain('@layer layer-1')
    expect(sheet2.cssRules[0]?.cssText).toContain('@layer layer-2')

    // cleanup
    mgr1.dispose()
    mgr2.dispose()
  })

  it('handles complex CSS rules with nested selectors and at-rules', () => {
    let before = document.adoptedStyleSheets.length
    let mgr = createStyleManager('rmx-test')
    let sheet = document.adoptedStyleSheets[before]

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

    expect(sheet.cssRules.length).toBe(1)
    let cssText = sheet.cssRules[0]?.cssText || ''
    expect(cssText).toContain('.rmx-complex')
    expect(cssText).toContain(':hover')
    expect(cssText).toContain('@media')

    // cleanup
    mgr.dispose()
  })

  it('removes only when count reaches zero and reindexes', () => {
    let before = document.adoptedStyleSheets.length
    let mgr = createStyleManager('rmx-test')
    let sheet = document.adoptedStyleSheets[before]
    mgr.insert('rmx-a', '.rmx-a { color: red; }')
    mgr.insert('rmx-b', '.rmx-b { color: blue; }')
    mgr.insert('rmx-a', '.rmx-a { color: red; }')

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
    let before = document.adoptedStyleSheets.length
    let mgr = createStyleManager('rmx-test')
    let sheet = document.adoptedStyleSheets[before]

    mgr.insert('rmx-a', '.rmx-a { color: red; }')
    mgr.insert('rmx-b', '.rmx-b { color: blue; }')
    mgr.insert('rmx-c', '.rmx-c { color: green; }')
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
    let before = document.adoptedStyleSheets.length
    let mgr = createStyleManager('rmx-test')
    let sheet = document.adoptedStyleSheets[before]

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
})
