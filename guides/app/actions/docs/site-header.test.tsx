import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/ui/server'

import { SiteHeader } from './site-header.tsx'

describe('SiteHeader', () => {
  it('renders expanded chapter navigation and closed mobile navigation state', async () => {
    let html = await renderToString(<SiteHeader />)

    assert.match(
      html,
      /id="docs-nav-toggle"[^>]*aria-controls="docs-chapters-navigation"[^>]*aria-expanded="true"/,
    )
    assert.match(
      html,
      /id="site-menu-toggle"[^>]*aria-controls="site-primary-navigation"[^>]*aria-expanded="false"/,
    )
    assert.match(html, />Guides<\/a>/)
  })

  it('renders search controls as unavailable', async () => {
    let html = await renderToString(<SiteHeader />)

    assert.equal(html.match(/<button[^>]*disabled/g)?.length, 2)
  })
})
