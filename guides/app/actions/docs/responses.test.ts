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
    assert.equal(response.headers.get('Cache-Control'), null)
    assert.equal(response.headers.get('ETag'), null)
    assert.equal(getChapterNavigationHtml(html).match(/aria-current="page"/g)?.length ?? 0, 0)
    assert.match(html, /href="\/start-here\/"/)
  })

  it('configures Pagefind around the searchable docs content', async () => {
    let router = createGuidesRouter()
    let response = await router.fetch(
      new Request(new URL(routes.docs.index.href(), 'http://localhost')),
    )
    let html = await response.text()

    assert.match(html, /<main[^>]*data-pagefind-body/)
    assert.match(getOpeningTag(html, 'ol', 'docs-index__cards'), /data-pagefind-ignore/)
    assert.match(html, /href="\/assets\/pagefind\/pagefind-component-ui\.css"/)
    assert.match(html, /src="\/assets\/pagefind\/pagefind-component-ui\.js"/)
    assert.match(html, /<pagefind-config base-url="\/" bundle-path="\/assets\/pagefind\/">/)
    assert.match(html, /<pagefind-modal[^>]*rmx-preserve-dom[^>]*reset-on-close/)
  })

  it('excludes chapter navigation chrome from the Pagefind index', async () => {
    let router = createGuidesRouter()
    let response = await router.fetch(
      new Request(new URL(routes.docs.chapter.href({ chapter: 'start-here' }), 'http://localhost')),
    )
    let html = await response.text()

    assert.match(getOpeningTag(html, 'nav', 'docs-breadcrumb'), /data-pagefind-ignore/)
    assert.match(getOpeningTag(html, 'nav', 'docs-pagination'), /data-pagefind-ignore/)
    assert.match(getOpeningTag(html, 'aside', 'docs-aside'), /data-pagefind-ignore/)
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
    assert.match(chapterNavigation, /href="\/start-here\/" aria-current="page"/)
  })
})

function getOpeningTag(html: string, tagName: string, className: string): string {
  let match = new RegExp(`<${tagName}[^>]*class="${className}"[^>]*>`).exec(html)
  if (!match) throw new Error(`Missing ${tagName}.${className}`)
  return match[0]
}

function getChapterNavigationHtml(html: string): string {
  let match = /<nav id="docs-chapters-navigation".*?<\/nav>/s.exec(html)
  if (!match) throw new Error('Missing chapter navigation')
  return match[0]
}
