import radio from '@remix-run/ui/radio'
import { createElement } from '@remix-run/ui'
import { renderToString } from '@remix-run/ui/server'
import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

describe('radio', () => {
  it('exports the default radio mixin with medium unchecked styling', async () => {
    let html = await renderToString(<input mix={radio()} />)

    expect(html).toMatch(/type="radio"/)
    expect(html).toMatch(/--rmx-radio-size: 16px/)
    expect(html).toMatch(/--rmx-radio-mark-size: 8px/)
    expect(html).toMatch(
      /border: 1px solid light-dark\(rgba\(0, 0, 0, 0\.12\), rgba\(255, 255, 255, 0\.2\)\)/,
    )
    expect(html).toMatch(/border-radius: 9999px/)
    expect(html).toMatch(/background: light-dark\(#FFFFFF, #1a1a1a\)/)
    expect(html).toMatch(/inset 0 1px 1px rgba\(0, 0, 0, 0\.06\)/)
  })

  it('supports large sizing', async () => {
    let html = await renderToString(<input mix={radio({ size: 'lg' })} />)

    expect(html).toMatch(/--rmx-radio-size: 20px/)
    expect(html).toMatch(/--rmx-radio-mark-size: 10px/)
  })

  it('styles checked states for native and custom hosts', async () => {
    let html = await renderToString(
      <>
        <input checked mix={radio()} readOnly />
        {createElement('span', { 'aria-checked': 'true', mix: radio() })}
        {createElement('span', { 'data-state': 'checked', mix: radio() })}
      </>,
    )

    expect(html).toMatch(/:checked/)
    expect(html).toMatch(/\[aria-checked="true"\]/)
    expect(html).toMatch(/\[data-state="checked"\]/)
    expect(html).toMatch(/light-dark\(#3573F6, #6eaaff\)/)
    expect(html).toMatch(/background-blend-mode: overlay, normal/)
    expect(html).toMatch(/0 0 16px rgba\(53, 115, 246, 0\.25\)/)
    expect(html).toMatch(/0 4px 4px -2px #0944BE/)
  })

  it('includes focus and disabled states without transitions', async () => {
    let html = await renderToString(
      <>
        <input disabled mix={radio()} />
        <input checked disabled mix={radio()} readOnly />
      </>,
    )

    expect(html).toMatch(/:focus-visible/)
    expect(html).toMatch(/outline: 0/)
    expect(html).toMatch(/0 0 0 1px light-dark\(#3573F6, #6eaaff\)/)
    expect(html).not.toMatch(/outline: 2px solid #1A72FF/)
    expect(html).toMatch(/&:disabled, &\[aria-disabled="true"\]/)
    expect(html).toMatch(/opacity: 0\.55/)
    expect(html).not.toMatch(/transition/)
    expect(html).not.toMatch(/cursor:/)
    expect(html).not.toMatch(/all: unset/)
  })

  it('preserves explicit input type overrides and supports non-input hosts', async () => {
    let explicitHtml = await renderToString(<input mix={radio()} type="checkbox" />)
    let spanHtml = await renderToString(createElement('span', { mix: radio() }))

    expect(explicitHtml).toMatch(/type="checkbox"/)
    expect(spanHtml).not.toMatch(/type="radio"/)
  })
})
