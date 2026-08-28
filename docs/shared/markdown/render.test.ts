import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { addHeadingIds } from './headings.ts'
import { parseMarkdownDocument } from './parser.ts'
import { renderMarkdownHtml } from './render.ts'

describe('renderMarkdownHtml', () => {
  it('preserves raw HTML', async () => {
    let { root } = parseMarkdownDocument(
      '# Example\n\n<section data-example="raw"><p>Rendered HTML</p></section>\n',
    )
    addHeadingIds(root)

    let html = await renderMarkdownHtml(root)

    assert.match(html, /<section data-example="raw"><p>Rendered HTML<\/p><\/section>/)
  })

  it('renders linked headings and transforms links', async () => {
    let { root } = parseMarkdownDocument('## Details\n\n[API](/api/example/)\n')
    addHeadingIds(root)

    let html = await renderMarkdownHtml(root, {
      transformLink(href) {
        return href.startsWith('/api/') ? `/v1${href}` : undefined
      },
    })

    assert.match(
      html,
      /<h2 id="details"><a class="docs-heading-link" href="#details">Details<\/a><\/h2>/,
    )
    assert.match(html, /<a href="\/v1\/api\/example\/">API<\/a>/)
  })
})
