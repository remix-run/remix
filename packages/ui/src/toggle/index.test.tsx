import toggle from '@remix-run/ui/toggle'
import * as togglePrimitive from '@remix-run/ui/toggle/primitives'
import { createElement, createRoot } from '@remix-run/ui'
import { renderToString } from '@remix-run/ui/server'
import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

describe('toggle', () => {
  it('exports the default toggle mixin with unchecked switch styling', async () => {
    let html = await renderToString(<input mix={toggle()} />)

    expect(html).toMatch(/type="checkbox"/)
    expect(html).toMatch(/role="switch"/)
    expect(html).toMatch(/--rmx-toggle-width: 30px/)
    expect(html).toMatch(/--rmx-toggle-height: 18px/)
    expect(html).toMatch(/width: var\(--rmx-toggle-width\)/)
    expect(html).toMatch(/height: var\(--rmx-toggle-height\)/)
    expect(html).toMatch(/#EBEBEB/)
    expect(html).toMatch(/inset 0 0 4px 1px rgba\(0, 0, 0, 0\.08\)/)
    expect(html).toMatch(/left: var\(--rmx-toggle-thumb-inset\)/)
    expect(html).toMatch(/width: var\(--rmx-toggle-thumb-width\)/)
    expect(html).toMatch(/height: var\(--rmx-toggle-thumb-height\)/)
    expect(html).toMatch(/--rmx-toggle-thumb-width: 18px/)
    expect(html).toMatch(/--rmx-toggle-thumb-height: 14px/)
  })

  it('supports large sizing', async () => {
    let html = await renderToString(<input mix={toggle({ size: 'lg' })} />)

    expect(html).toMatch(/--rmx-toggle-width: 36px/)
    expect(html).toMatch(/--rmx-toggle-height: 22px/)
    expect(html).toMatch(/--rmx-toggle-thumb-width: 22px/)
    expect(html).toMatch(/--rmx-toggle-thumb-height: 18px/)
  })

  it('styles checked states for native and custom hosts', async () => {
    let html = await renderToString(
      <>
        <input checked mix={toggle()} readOnly />
        {createElement('span', { 'aria-checked': 'true', mix: toggle() })}
        {createElement('span', { 'data-state': 'checked', mix: toggle() })}
      </>,
    )

    expect(html).toMatch(/:checked/)
    expect(html).toMatch(/\[aria-checked="true"\]/)
    expect(html).toMatch(/\[data-state="checked"\]/)
    expect(html).toMatch(/#70C754/)
    expect(html).toMatch(/0 0 12px 1px rgba\(112, 199, 84, 0\.25\)/)
    expect(html).toMatch(/transform: translateX\(var\(--rmx-toggle-thumb-translate-x\)\)/)
    expect(html).toMatch(
      /--rmx-toggle-thumb-translate-x: calc\(var\(--rmx-toggle-width\) - var\(--rmx-toggle-thumb-width\) - \(var\(--rmx-toggle-thumb-inset\) \* 2\)\)/,
    )
    expect(html).not.toMatch(/translateX\(8px\)/)
    expect(html).not.toMatch(/left: 10px/)
    expect(html).toMatch(/0 4px 6px -2px rgba\(66, 134, 44, 0\.6\)/)
  })

  it('includes focus, disabled, and reduced motion states', async () => {
    let html = await renderToString(
      <>
        <input disabled mix={toggle()} />
        <input checked disabled mix={toggle()} readOnly />
      </>,
    )

    expect(html).toMatch(/:focus-visible/)
    expect(html).toMatch(/outline: 0/)
    expect(html).toMatch(/0 0 0 1px #3573F6/)
    expect(html).toMatch(/&:disabled, &\[aria-disabled="true"\]/)
    expect(html).toMatch(/opacity: 0\.55/)
    expect(html).toMatch(
      /transition: transform 160ms ease, background 160ms ease, box-shadow 160ms ease/,
    )
    expect(html).not.toMatch(/@starting-style/)
    expect(html).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
    expect(html).toMatch(/transition: none/)
    expect(html).not.toMatch(/data-rmx-toggle-motion/)
    expect(html).not.toMatch(/cursor:/)
    expect(html).not.toMatch(/all: unset/)
  })

  it('does not transition on initial render', async () => {
    let container = document.createElement('div')
    document.body.append(container)

    let transitionRuns: TransitionEvent[] = []
    container.addEventListener('transitionrun', (event) => {
      transitionRuns.push(event as TransitionEvent)
    })

    let root = createRoot(container)
    root.render(
      <>
        <input checked mix={toggle()} readOnly />
        <input checked mix={toggle({ size: 'lg' })} readOnly />
      </>,
    )
    root.flush()

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve()
        })
      })
    })

    expect(transitionRuns).toEqual([])
    root.dispose()
    container.remove()
  })

  it('toggles composed uncontrolled state after hydration', async () => {
    let changes: boolean[] = []
    let html = await renderToString(
      <>
        <label>
          <input
            defaultChecked
            mix={[...toggle(), togglePrimitive.control()]}
            name="sync"
            value="auto"
          />
          Automatic sync
        </label>
        <label>
          <input
            mix={[...toggle({ size: 'lg' }), togglePrimitive.control()]}
            name="sync"
            value="preview"
          />
          Live preview large
        </label>
      </>,
    )

    let container = document.createElement('div')
    document.body.append(container)
    container.innerHTML = html
    let serverInputs = [...container.querySelectorAll('input')] as HTMLInputElement[]
    let root = createRoot(container)
    root.render(
      <>
        <label>
          <input
            defaultChecked
            mix={[
              ...toggle(),
              togglePrimitive.control({
                onCheckedChange(checked) {
                  changes.push(checked)
                },
              }),
            ]}
            name="sync"
            value="auto"
          />
          Automatic sync
        </label>
        <label>
          <input
            mix={[
              ...toggle({ size: 'lg' }),
              togglePrimitive.control({
                onCheckedChange(checked) {
                  changes.push(checked)
                },
              }),
            ]}
            name="sync"
            value="preview"
          />
          Live preview large
        </label>
      </>,
    )
    root.flush()

    let [automaticSync, livePreview] = [
      container.querySelector('input[value="auto"]'),
      container.querySelector('input[value="preview"]'),
    ] as HTMLInputElement[]

    expect(container.querySelectorAll('input')).toHaveLength(2)
    expect(automaticSync).toBe(serverInputs[0])
    expect(livePreview).toBe(serverInputs[1])

    expect(automaticSync.checked).toBe(true)
    expect(automaticSync.getAttribute('data-state')).toBe('checked')
    expect(livePreview.checked).toBe(false)
    expect(livePreview.getAttribute('data-state')).toBe('unchecked')

    automaticSync.click()
    root.flush()
    expect(changes).toEqual([false])
    expect(automaticSync.checked).toBe(false)
    expect(automaticSync.getAttribute('data-state')).toBe('unchecked')

    livePreview.click()
    root.flush()
    expect(changes).toEqual([false, true])
    expect(livePreview.checked).toBe(true)
    expect(livePreview.getAttribute('data-state')).toBe('checked')

    livePreview.click()
    root.flush()
    expect(changes).toEqual([false, true, false])
    expect(livePreview.checked).toBe(false)
    expect(livePreview.getAttribute('data-state')).toBe('unchecked')

    root.dispose()
    container.remove()
  })

  it('preserves explicit input type overrides and supports non-input hosts', async () => {
    let explicitHtml = await renderToString(<input mix={toggle()} type="radio" />)
    let spanHtml = await renderToString(createElement('span', { mix: toggle() }))

    expect(explicitHtml).toMatch(/type="radio"/)
    expect(explicitHtml).not.toMatch(/role="switch"/)
    expect(spanHtml).not.toMatch(/type="checkbox"/)
  })

  it('server-renders primitive composition as a native checkbox switch', async () => {
    let html = await renderToString(
      <input defaultChecked mix={[...toggle(), togglePrimitive.control()]} name="notifications" />,
    )

    expect(html).toMatch(/type="checkbox"/)
    expect(html).toMatch(/role="switch"/)
    expect(html).toMatch(/data-state="checked"/)
    expect(html).toMatch(/name="notifications"/)
    expect(html).not.toMatch(/<input[^>]*aria-checked=/)
  })
})
