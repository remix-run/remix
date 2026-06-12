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
    expect(html).toMatch(/background: #FCFCFC/)
    expect(html).toMatch(/font-size: 12px/)
    expect(html).toMatch(/text-shadow: 0 1px 0 #FFFFFF/)
  })

  it('supports primary and large variants', async () => {
    let html = await renderToString(<button mix={button({ size: 'lg', tone: 'primary' })}>Add</button>)

    expect(html).toMatch(/height: 30px/)
    expect(html).toMatch(/font-size: 13px/)
    expect(html).toMatch(/#101010/)
    expect(html).toMatch(/text-shadow: 0 1px 1px #000000/)
  })

  it('preserves explicit button type overrides and supports non-button hosts', async () => {
    let explicitHtml = await renderToString(
      <button mix={button()} type="submit">
        Save
      </button>,
    )
    let anchorHtml = await renderToString(
      createElement(
        'a',
        { href: '/orders', mix: button({ tone: 'primary' }) },
        'View orders',
      ),
    )

    expect(explicitHtml).toMatch(/type="submit"/)
    expect(anchorHtml).not.toMatch(/type="button"/)
    expect(anchorHtml).toMatch(/href="\/orders"/)
  })
})
