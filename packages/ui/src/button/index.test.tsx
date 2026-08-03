import button from '@remix-run/ui/button'
import { createElement } from '@remix-run/ui'
import { renderToString } from '@remix-run/ui/server'
import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

describe('button', () => {
  it('exports the default button mixin with neutral medium styling', async () => {
    let html = await renderToString(<button mix={button()}>Edit order</button>)

    expect(html).toMatch(/type="button"/)
    expect(html).toMatch(/height: 26px/)
    expect(html).toMatch(/background: light-dark\(#FCFCFC, #232323\)/)
    expect(html).toMatch(/font-size: 12px/)
    expect(html).toMatch(/text-shadow: 0 1px 0 light-dark\(#FFFFFF, rgb\(0 0 0 \/ 0\.35\)\)/)
  })

  it('supports primary and large variants', async () => {
    let html = await renderToString(
      <button mix={button({ size: 'lg', tone: 'primary' })}>Add</button>,
    )

    expect(html).toMatch(/height: 30px/)
    expect(html).toMatch(/font-size: 13px/)
    expect(html).toMatch(/light-dark\(#101010, #ececec\)/)
    expect(html).toMatch(
      /text-shadow: 0 1px 1px light-dark\(#000000, rgb\(255 255 255 \/ 0\.45\)\)/,
    )
  })

  it('supports ghost styling', async () => {
    let html = await renderToString(<button mix={button({ tone: 'ghost' })}>Cancel</button>)

    expect(html).toMatch(/background: transparent/)
    expect(html).toMatch(/border: 1px solid transparent/)
    expect(html).toMatch(/--rmx-button-shadow: 0 0 0 0 rgba\(0, 0, 0, 0\)/)
    expect(html).toMatch(
      /background: light-dark\(rgba\(16, 16, 16, 0\.05\), rgba\(236, 236, 236, 0\.1\)\)/,
    )
  })

  it('includes hover, focus, active, and pressed states without transitions', async () => {
    let html = await renderToString(
      <>
        <button mix={button()}>Neutral</button>
        <button aria-pressed="true" mix={button({ tone: 'primary' })}>
          Primary
        </button>
      </>,
    )

    expect(html).toMatch(/:hover:not\(:disabled\):not\(\[aria-disabled="true"\]\)/)
    expect(html).toMatch(/:focus-visible/)
    expect(html).toMatch(/outline: 0/)
    expect(html).toMatch(/box-shadow: var\(--rmx-button-focus-shadow\)/)
    expect(html).toMatch(
      /0 0 0 1px light-dark\(#3573F6, #6eaaff\), var\(--rmx-button-shadow\)/,
    )
    expect(html).toMatch(/0 0 0 1px light-dark\(#3573F6, #6eaaff\)/)
    expect(html).toMatch(
      /0 0 0 4px light-dark\(rgba\(53, 115, 246, 0\.1\), rgba\(110, 170, 255, 0\.18\)\)/,
    )
    expect(html).toMatch(
      /inset 0 0 8px 1px light-dark\(rgba\(53, 115, 246, 0\.05\), rgba\(110, 170, 255, 0\.1\)\)/,
    )
    expect(html).toMatch(/:active:not\(:disabled\):not\(\[aria-disabled="true"\]\)/)
    expect(html).toMatch(/transform: translateY\(1px\)/)
    expect(html).toMatch(/\[aria-pressed="true"\]:not\(:disabled\)/)
    expect(html).not.toMatch(/transition/)
    expect(html).not.toMatch(/cursor: pointer/)
    expect(html).not.toMatch(/all: unset/)
  })

  it('includes disabled styling for every tone', async () => {
    let html = await renderToString(
      <>
        <button disabled mix={button()}>
          Neutral
        </button>
        <button disabled mix={button({ tone: 'primary' })}>
          Primary
        </button>
        <button disabled mix={button({ tone: 'ghost' })}>
          Ghost
        </button>
      </>,
    )

    expect(html).toMatch(/&:disabled, &\[aria-disabled="true"\]/)
    expect(html).toMatch(/cursor: not-allowed/)
    expect(html).toMatch(/opacity: 0\.55/)
  })

  it('preserves explicit button type overrides and supports non-button hosts', async () => {
    let explicitHtml = await renderToString(
      <button mix={button()} type="submit">
        Save
      </button>,
    )
    let anchorHtml = await renderToString(
      createElement('a', { href: '/orders', mix: button({ tone: 'primary' }) }, 'View orders'),
    )

    expect(explicitHtml).toMatch(/type="submit"/)
    expect(anchorHtml).not.toMatch(/type="button"/)
    expect(anchorHtml).toMatch(/href="\/orders"/)
  })
})
