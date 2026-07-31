import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/ui/server'

import { PagefindElements } from './pagefind-elements.tsx'

describe('PagefindElements', () => {
  it('renders config and modal with the provided asset paths', async () => {
    let html = await renderToString(
      <PagefindElements baseUrl="/" bundlePath="/assets/pagefind/" />,
    )

    assert.match(html, /<pagefind-config base-url="\/" bundle-path="\/assets\/pagefind\/">/)
    assert.match(html, /<pagefind-modal[^>]*data-key="pagefind-modal"/)
    assert.match(html, /<pagefind-modal[^>]*rmx-preserve-dom/)
    assert.match(html, /<pagefind-modal[^>]*reset-on-close/)
  })
})
