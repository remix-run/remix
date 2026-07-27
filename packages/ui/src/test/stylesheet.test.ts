import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
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

    // Server-rendered selector should be recognized as existing
    expect(mgr.has('rmxc-server1')).toBe(true)

    // Ensure the adopted stylesheet content exists in constructed sheets
    let hasAdoptedRule = Array.from(document.adoptedStyleSheets).some((sheet) => {
      let text = Array.from(sheet.cssRules)
        .map((r) => (r as any).cssText || '')
        .join('\n')
      return text.includes('rmxc-server1')
    })
    expect(hasAdoptedRule).toBe(true)

    // Server-adopted rules are pinned: mixin insert/remove cycles (e.g. a
    // hydrated element mounting and later unmounting) never drop the rule.
    mgr.insert('rmxc-server1', '.rmxc-server1 { color: blue; }')
    mgr.remove('rmxc-server1')
    mgr.remove('rmxc-server1')
    expect(mgr.has('rmxc-server1')).toBe(true)

    // cleanup
    mgr.dispose()
  })

  it('does not start transitions when adopting server-rendered styles', async () => {
    let host = document.createElement('div')
    let serverStyle = document.createElement('style')
    serverStyle.setAttribute('data-rmx', 'rmxc-adopt-transition')
    serverStyle.textContent = `
      @layer rmx-test.rmxc-adopt-transition {
        .rmxc-adopt-transition {
          --offset: 8px;
          display: block;
          width: 30px;
          height: 18px;
        }

        .rmxc-adopt-transition::before {
          content: "";
          display: block;
          width: 10px;
          height: 14px;
          transform: translateX(0);
          transition: transform 80ms ease, width 80ms ease;
        }

        .rmxc-adopt-transition[data-state="checked"]::before {
          width: 18px;
          transform: translateX(var(--offset));
        }
      }
    `

    let el = document.createElement('div')
    el.className = 'rmxc-adopt-transition'
    el.dataset.state = 'checked'
    host.append(serverStyle, el)
    document.body.append(host)

    let beforeTransform = getComputedStyle(el, '::before').transform
    let beforeWidth = getComputedStyle(el, '::before').width
    expect(beforeTransform).toBe('matrix(1, 0, 0, 1, 8, 0)')
    expect(beforeWidth).toBe('18px')

    let transitionRuns: string[] = []
    el.addEventListener('transitionrun', (event) => {
      let transition = event as TransitionEvent
      transitionRuns.push(`${transition.pseudoElement}:${transition.propertyName}`)
    })

    let mgr = createStyleManager('rmx-test')
    mgr.adoptServerStyles([host])
    await waitForTransitionWindow()

    expect(getComputedStyle(el, '::before').transform).toBe(beforeTransform)
    expect(getComputedStyle(el, '::before').width).toBe(beforeWidth)
    expect(transitionRuns).toEqual([])

    host.remove()
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

  it('adoptServerStyles returns the set of selectors it processed', () => {
    let mgr = createStyleManager('rmx-test')

    let container = document.createElement('div')
    for (let selector of ['rmxc-first', 'rmxc-second']) {
      let style = document.createElement('style')
      style.setAttribute('data-rmx', selector)
      style.textContent = `@layer rmx-test { .${selector} { color: red; } }`
      container.appendChild(style)
    }
    document.body.appendChild(container)

    let firstAdoption = mgr.adoptServerStyles([container])
    expect(Array.from(firstAdoption).sort()).toEqual(['rmxc-first', 'rmxc-second'])

    // Re-adopting the same selector returns it in the set even when the rule
    // is short-circuited as a duplicate.
    let duplicateStyle = document.createElement('style')
    duplicateStyle.setAttribute('data-rmx', 'rmxc-first')
    duplicateStyle.textContent = '@layer rmx-test { .rmxc-first { color: red; } }'
    container.appendChild(duplicateStyle)

    let secondAdoption = mgr.adoptServerStyles([container])
    expect(Array.from(secondAdoption)).toEqual(['rmxc-first'])

    container.remove()
    mgr.dispose()
  })

  it('selectors() iterates the currently-tracked selectors', () => {
    let mgr = createStyleManager('rmx-test')
    expect(Array.from(mgr.selectors())).toEqual([])

    mgr.insert('rmx-a', '.rmx-a { color: red; }')
    mgr.insert('rmx-b', '.rmx-b { color: blue; }')
    expect(Array.from(mgr.selectors()).sort()).toEqual(['rmx-a', 'rmx-b'])

    mgr.dispose()
  })

  it('keeps server-adopted rules across later adoptions (pinning)', () => {
    let mgr = createStyleManager('rmx-test')

    // First page: adopts A and shared
    let first = document.createElement('div')
    for (let selector of ['rmxc-only-first', 'rmxc-shared']) {
      let style = document.createElement('style')
      style.setAttribute('data-rmx', selector)
      style.textContent = `@layer rmx-test { .${selector} { color: red; } }`
      first.appendChild(style)
    }
    document.body.appendChild(first)
    mgr.adoptServerStyles([first])
    first.remove()

    expect(mgr.has('rmxc-only-first')).toBe(true)
    expect(mgr.has('rmxc-shared')).toBe(true)

    // Navigate: second page adopts B and shared. Adoption is additive — rules
    // are content-addressed so a prior page's rules can never become wrong,
    // and DOM preserved across the transition keeps its styling.
    let second = document.createElement('div')
    for (let selector of ['rmxc-only-second', 'rmxc-shared']) {
      let style = document.createElement('style')
      style.setAttribute('data-rmx', selector)
      style.textContent = `@layer rmx-test { .${selector} { color: blue; } }`
      second.appendChild(style)
    }
    document.body.appendChild(second)
    mgr.adoptServerStyles([second])
    second.remove()

    expect(mgr.has('rmxc-only-first')).toBe(true)
    expect(mgr.has('rmxc-shared')).toBe(true)
    expect(mgr.has('rmxc-only-second')).toBe(true)

    mgr.dispose()
  })

  it('pins a client-inserted rule when a server tag for the same selector is adopted', () => {
    let mgr = createStyleManager('rmx-test')

    // A client-side css mixin inserts first (e.g. transient UI state), then a
    // streamed fragment arrives carrying the same selector.
    mgr.insert('rmxc-upgrade', '.rmxc-upgrade { color: red; }')

    let host = document.createElement('div')
    let style = document.createElement('style')
    style.setAttribute('data-rmx', 'rmxc-upgrade')
    style.textContent = '@layer rmx-test { .rmxc-upgrade { color: red; } }'
    host.appendChild(style)
    document.body.appendChild(host)
    mgr.adoptServerStyles([host])
    host.remove()

    // The mixin unmounting no longer drops the rule — server DOM may still
    // reference it.
    mgr.remove('rmxc-upgrade')
    expect(mgr.has('rmxc-upgrade')).toBe(true)

    mgr.dispose()
  })

  it('drops client-only rules when their last ref is removed', () => {
    let mgr = createStyleManager('rmx-test')

    // Dynamic styles mint a new class per value; rules that never came from
    // the server must be released so they cannot accumulate.
    mgr.insert('rmxc-dynamic', '.rmxc-dynamic { width: 41px; }')
    mgr.insert('rmxc-dynamic', '.rmxc-dynamic { width: 41px; }')
    mgr.remove('rmxc-dynamic')
    expect(mgr.has('rmxc-dynamic')).toBe(true)
    mgr.remove('rmxc-dynamic')
    expect(mgr.has('rmxc-dynamic')).toBe(false)

    mgr.dispose()
  })
})

async function waitForTransitionWindow(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await new Promise<void>((resolve) => setTimeout(resolve, 120))
}
