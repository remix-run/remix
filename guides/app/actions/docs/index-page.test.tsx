import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/ui/server'

import { ChapterCard } from './index-page.tsx'
import type { DocsChapterSummary } from './markdown-chapters.tsx'

const chapter: DocsChapterSummary = {
  order: 2,
  slug: 'routing-and-controllers',
  href: '/docs/routing-and-controllers',
  chapter: 'Chapter 2',
  title: 'Routing and Controllers',
  description: 'Route requests through Remix.',
  sections: [
    {
      id: 'route-contract',
      title: 'Routes as the URL contract',
      titleHtml: 'Routes as the URL contract',
    },
  ],
  mtime: 1,
}

describe('ChapterCard', () => {
  it('formats the chapter order with two digits', async () => {
    let html = await renderToString(<ChapterCard chapter={chapter} />)

    assert.match(html, /chapter-card__eyebrow">02<\/div>/)
  })

  it('hides cloned topic links from assistive technology and the tab order', async () => {
    let html = await renderToString(<ChapterCard chapter={chapter} />)

    assert.equal(html.match(/href="\/docs\/routing-and-controllers#route-contract"/g)?.length, 2)
    assert.match(
      html,
      /<ul aria-hidden="true" class="chapter-card__links chapter-card__links--clone">/,
    )
    assert.equal(html.match(/tabindex="-1"/g)?.length, 1)
  })
})
