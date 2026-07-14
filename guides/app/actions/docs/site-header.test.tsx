import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/ui/server'

import { SiteFooter } from './site-footer.tsx'
import { SiteHeader } from './site-header.tsx'

describe('SiteHeader', () => {
  it('renders expanded chapter navigation and a native mobile menu', async () => {
    let html = await renderToString(<SiteHeader />)

    assert.match(
      html,
      /id="docs-nav-toggle"[^>]*aria-controls="docs-chapters-navigation"[^>]*aria-expanded="true"/,
    )
    assert.match(html, /id="site-menu-toggle"[^>]*popovertarget="site-primary-navigation"/)
    assert.match(html, /id="site-primary-navigation"[^>]*popover="auto"/)
    assert.equal(html.match(/>Guides<\/a>/g)?.length, 2)
    assert.match(html, /href="\/icons\.svg#layout-left"/)
    assert.equal(html.match(/href="\/icons\.svg#search"/g)?.length, 2)
  })

  it('renders only the expanded search treatment to assistive technology', async () => {
    let html = await renderToString(<SiteHeader />)

    assert.equal(html.match(/<button[^>]*disabled/g)?.length, 2)
    assert.match(html, /id="docs-search-compact"[^>]*aria-hidden="true"/)
    assert.doesNotMatch(html, /id="docs-search-button"[^>]*aria-hidden/)
  })

  it('shares the standalone wordmark asset with the footer', async () => {
    let headerHtml = await renderToString(<SiteHeader />)
    let footerHtml = await renderToString(<SiteFooter />)
    let wordmark = /src="\/remix-wordmark-light-mode\.svg"/

    assert.match(headerHtml, wordmark)
    assert.match(footerHtml, wordmark)
  })
})
