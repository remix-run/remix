import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createGuidesRouter } from '../../router.ts'
import { routes } from '../../routes.ts'

describe('docs responses', () => {
  it('renders no current chapter on the index', async () => {
    let router = createGuidesRouter()
    let response = await router.fetch(
      new Request(new URL(routes.docs.index.href(), 'http://localhost')),
    )
    let html = await response.text()

    assert.equal(response.status, 200)
    assert.equal(getChapterNavigationHtml(html).match(/aria-current="page"/g)?.length ?? 0, 0)
    assert.match(html, /href="\/docs\/start-here"/)
  })

  it('marks exactly one chapter current on a chapter response', async () => {
    let router = createGuidesRouter()
    let response = await router.fetch(
      new Request(new URL(routes.docs.chapter.href({ chapter: 'start-here' }), 'http://localhost')),
    )
    let html = await response.text()

    assert.equal(response.status, 200)
    let chapterNavigation = getChapterNavigationHtml(html)
    assert.equal(chapterNavigation.match(/aria-current="page"/g)?.length, 1)
    assert.match(chapterNavigation, /href="\/docs\/start-here" aria-current="page"/)
  })
})

function getChapterNavigationHtml(html: string): string {
  let match = /<nav id="docs-chapters-navigation".*?<\/nav>/s.exec(html)
  if (!match) throw new Error('Missing chapter navigation')
  return match[0]
}
