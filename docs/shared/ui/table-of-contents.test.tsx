import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/ui/server'

import { DocsTableOfContents } from './table-of-contents.tsx'

describe('DocsTableOfContents', () => {
  it('renders the first heading as current and indents h3 links', async () => {
    let html = await renderToString(
      <DocsTableOfContents
        headings={[
          { id: 'section', depth: 2, title: 'Section', titleHtml: 'Section' },
          { id: 'detail', depth: 3, title: 'Detail', titleHtml: 'Detail' },
        ]}
      />,
    )

    assert.match(html, /<li><a href="#section" aria-current="location">Section<\/a><\/li>/)
    assert.match(html, /<li class="docs-toc__item--nested"><a href="#detail">Detail<\/a><\/li>/)
  })
})
