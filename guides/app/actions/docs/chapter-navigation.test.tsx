import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/ui/server'

import { ChapterNavigation } from './chapter-navigation.tsx'
import type { DocsNavigationItem } from './markdown-chapters.tsx'

const chapters: DocsNavigationItem[] = [
  {
    order: 1,
    slug: 'start-here',
    href: '/docs/start-here',
    title: 'Start Here',
  },
  {
    order: 2,
    slug: 'routing-and-controllers',
    href: '/docs/routing-and-controllers',
    title: 'Routing and Controllers',
  },
]

describe('ChapterNavigation', () => {
  it('renders numeric order and the chapter title', async () => {
    let html = await renderToString(<ChapterNavigation chapters={chapters} />)

    assert.match(html, /docs-chapters-nav__eyebrow">1\.<\/span>/)
    assert.match(html, /Routing and Controllers/)
  })

  it('marks only the current chapter', async () => {
    let html = await renderToString(
      <ChapterNavigation chapters={chapters} currentSlug="routing-and-controllers" />,
    )

    assert.equal(html.match(/aria-current="page"/g)?.length, 1)
    assert.match(html, /href="\/docs\/routing-and-controllers" aria-current="page"/)
  })
})
