import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/ui/server'

import { DocsFooter } from './docs-footer.tsx'

describe('DocsFooter', () => {
  it('renders the Remix brand, social links, and legal copy', async () => {
    let html = await renderToString(<DocsFooter />)

    assert.match(html, /src="\/remix-wordmark-light-mode\.svg"/)
    assert.match(html, /href="https:\/\/github\.com\/remix-run"[^>]*aria-label="GitHub"/)
    assert.match(html, /href="\/icons\.svg#github"/)
    assert.match(html, /docs and examples licensed under mit/)
    assert.match(html, new RegExp(`©${new Date().getFullYear()} Shopify, Inc.`))
    assert.doesNotMatch(html, /class="[^"]*site-footer/)
    assert.doesNotMatch(html, /\[object Object\]/)
  })
})
