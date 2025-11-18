import { describe, it, expect } from 'vitest'
import { createStyleManager } from './stylesheet.ts'

describe.skip('createStyleManager', () => {
  it('inserts a rule once and increments count on repeat', () => {
    let before = document.adoptedStyleSheets.length
    let mgr = createStyleManager('rmx-test')
    let sheet = document.adoptedStyleSheets[before]
    mgr.insert('rmx-a', '.rmx-a { color: red; }')
    mgr.insert('rmx-a', '.rmx-a { color: red; }')
    // No exception means double insert increases count and does not duplicate
    expect(mgr.has('rmx-a')).toBe(true)
    // Sheet has exactly one rule block with our class once
    let cssText = sheet.cssRules[0]?.cssText || ''
    expect(cssText.includes('rmx-test')).toBe(true)
    expect(cssText.split('.rmx-a').length - 1).toBe(1)
    // cleanup
    document.adoptedStyleSheets = Array.from(document.adoptedStyleSheets).filter((s) => s !== sheet)
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
    document.adoptedStyleSheets = Array.from(document.adoptedStyleSheets).filter((s) => s !== sheet)
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
    document.adoptedStyleSheets = Array.from(document.adoptedStyleSheets).filter((s) => s !== sheet)
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
    document.adoptedStyleSheets = Array.from(document.adoptedStyleSheets).filter((s) => s !== sheet)
  })
})
