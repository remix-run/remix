import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/ui/server'

import { ChapterNavigationContent } from './chapter-navigation.tsx'
import type { DocsNavigationItem } from './markdown-chapters.tsx'

const chapters: DocsNavigationItem[] = [
  {
    order: 1,
    slug: 'start-here',
    href: '/start-here/',
    title: 'Start Here',
  },
  {
    order: 2,
    slug: 'routing-and-controllers',
    href: '/routing-and-controllers/',
    title: 'Routing and Controllers',
  },
]

describe('ChapterNavigationContent', () => {
  it('renders numeric order and the chapter title', async () => {
    let html = await renderToString(<ChapterNavigationContent chapters={chapters} />)

    assert.match(html, /docs-chapters-nav__eyebrow">1\.<\/span>/)
    assert.match(html, /Routing and Controllers/)
  })

  it('marks only the current chapter', async () => {
    let html = await renderToString(
      <ChapterNavigationContent chapters={chapters} currentSlug="routing-and-controllers" />,
    )

    assert.equal(html.match(/aria-current="page"/g)?.length, 1)
    assert.match(html, /href="\/routing-and-controllers\/" aria-current="page"/)
  })
})
