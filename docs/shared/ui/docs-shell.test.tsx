import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/ui/server'

import { DocsShell } from './docs-shell.tsx'

describe('DocsShell', () => {
  it('renders site-owned content into shared shell regions', async () => {
    let html = await renderToString(
      <DocsShell
        header={<header>Header content</header>}
        navigation={
          <ol>
            <li>Navigation content</li>
          </ol>
        }
        navigationLabel="Guide chapters"
        navigationName="chapter navigation"
        footer={<footer>Footer content</footer>}
      >
        <article>Main content</article>
      </DocsShell>,
    )

    assert.match(html, /href="#main-content"[^>]*>Skip to content<\/a>/)
    assert.match(html, /<header>Header content<\/header>/)
    assert.match(
      html,
      /id="docs-navigation-toggle"[^>]*aria-controls="docs-navigation"[^>]*aria-expanded="true"[^>]*aria-label="Collapse chapter navigation"/,
    )
    assert.match(html, /<nav id="docs-navigation"[^>]*aria-label="Guide chapters"/)
    assert.match(html, /<main id="main-content"[^>]*data-docs-main[^>]*data-pagefind-body/)
    assert.match(html, /<article>Main content<\/article>/)
    assert.match(html, /<footer>Footer content<\/footer>/)
    assert.doesNotMatch(html, /\[object Object\]/)
  })
})
