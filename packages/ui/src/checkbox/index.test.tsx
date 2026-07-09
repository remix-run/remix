import checkbox from '@remix-run/ui/checkbox'
import { createElement } from '@remix-run/ui'
import { renderToString } from '@remix-run/ui/server'
import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

describe('checkbox', () => {
  it('exports the default checkbox mixin with medium unchecked styling', async () => {
    let html = await renderToString(<input mix={checkbox()} />)

    expect(html).toMatch(/type="checkbox"/)
    expect(html).toMatch(/--rmx-checkbox-size: 16px/)
    expect(html).toMatch(/border-radius: var\(--rmx-checkbox-radius\)/)
    expect(html).toMatch(/background: light-dark\(#FFFFFF, #1a1a1a\)/)
    expect(html).toMatch(
      /0 0 0 1px light-dark\(rgba\(0, 0, 0, 0\.12\), rgba\(255, 255, 255, 0\.2\)\)/,
    )
  })

  it('supports large sizing', async () => {
    let html = await renderToString(<input mix={checkbox({ size: 'lg' })} />)

    expect(html).toMatch(/--rmx-checkbox-size: 20px/)
    expect(html).toMatch(/--rmx-checkbox-radius: 5px/)
    expect(html).toMatch(/--rmx-checkbox-check-size: 15px/)
  })

  it('styles checked and mixed states for native and custom hosts', async () => {
    let html = await renderToString(
      <>
        <input defaultChecked mix={checkbox()} />
        <input mix={checkbox({ state: 'mixed' })} />
        {createElement('span', { mix: checkbox({ state: 'checked' }) })}
      </>,
    )

    expect(html).toMatch(/:checked/)
    expect(html).toMatch(/\[aria-checked="true"\]/)
    expect(html).toMatch(/\[data-state="checked"\]/)
    expect(html).toMatch(/aria-checked="mixed"/)
    expect(html).toMatch(/data-state="mixed"/)
    expect(html).toMatch(/aria-checked="true"/)
    expect(html).toMatch(/data-state="checked"/)
    expect(html).toMatch(/:indeterminate/)
    expect(html).toMatch(/\[aria-checked="mixed"\]/)
    expect(html).toMatch(/light-dark\(#3573F6, #6eaaff\)/)
    expect(html).toMatch(/M2\.75 5\.76562L5\.10156 8\.25L9\.23438 1\.75/)
    expect(html).toMatch(/drop-shadow\(0 1px 2px rgba\(0, 0, 0, 0\.4\)\)/)
  })

  it('includes focus, active, and disabled states without transitions', async () => {
    let html = await renderToString(
      <>
        <input disabled mix={checkbox()} />
        <input defaultChecked disabled mix={checkbox()} />
        <input disabled mix={checkbox({ state: 'mixed' })} />
      </>,
    )

    expect(html).toMatch(/:focus-visible/)
    expect(html).toMatch(/outline: 0/)
    expect(html).toMatch(/0 0 0 1px light-dark\(#3573F6, #6eaaff\)/)
    expect(html).not.toMatch(/outline: 2px solid #1A72FF/)
    expect(html).toMatch(/:active:not\(:disabled\):not\(\[aria-disabled="true"\]\)/)
    expect(html).toMatch(/0 6px 8px -4px rgba\(9, 68, 190, 0\.1\)/)
    expect(html).toMatch(/0 2px 6px rgba\(53, 115, 246, 0\.32\)/)
    expect(html).toMatch(/inset 0 1px 2px rgba\(0, 0, 0, 0\.3\)/)
    expect(html).toMatch(/&:disabled, &\[aria-disabled="true"\]/)
    expect(html).toMatch(/opacity: 0\.55/)
    expect(html).not.toMatch(/transition/)
    expect(html).not.toMatch(/cursor:/)
    expect(html).not.toMatch(/all: unset/)
  })

  it('preserves explicit input type overrides and supports non-input hosts', async () => {
    let explicitHtml = await renderToString(<input mix={checkbox()} type="radio" />)
    let spanHtml = await renderToString(createElement('span', { mix: checkbox() }))

    expect(explicitHtml).toMatch(/type="radio"/)
    expect(spanHtml).not.toMatch(/type="checkbox"/)
  })
})
