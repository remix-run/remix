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

  it('shows unfinished chapters with links to package READMEs', async () => {
    let router = createGuidesRouter()
    let response = await router.fetch(
      new Request(
        new URL(routes.docs.chapter.href({ chapter: 'data-and-validation' }), 'http://localhost'),
      ),
    )
    let html = await response.text()

    assert.equal(response.status, 200)
    assert.match(html, /This chapter is unfinished\./)
    assert.match(
      html,
      /https:\/\/github\.com\/remix-run\/remix\/blob\/main\/packages\/data-schema\/README\.md/,
    )
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
    assert.match(html, /<pagefind-modal[^>]*data-rmx-preserve-dom[^>]*reset-on-close/)
    assert.match(html, /\/assets\/docs-shared\/ui\/public\/docs-shell\.tsx/)
  })

  it('excludes chapter navigation chrome from the Pagefind index', async () => {
    let router = createGuidesRouter()
    let response = await router.fetch(
      new Request(new URL(routes.docs.chapter.href({ chapter: 'start-here' }), 'http://localhost')),
    )
    let html = await response.text()

    assert.match(getOpeningTag(html, 'nav', 'docs-breadcrumb'), /data-pagefind-ignore/)
    assert.match(getOpeningTag(html, 'nav', 'docs-pagination'), /data-pagefind-ignore/)
    assert.match(getTagById(html, 'aside', 'docs-secondary-navigation'), /data-pagefind-ignore/)
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
    assert.match(
      getOpeningTag(html, 'div', 'docs-layout'),
      /data-rmx-key="docs-chapter-start-here"/,
    )
    assert.match(html, /\/assets\/docs-shared\/ui\/public\/code-block-copy\.tsx/)
  })

  it('links chapter pages to their markdown source', async () => {
    let router = createGuidesRouter()
    let response = await router.fetch(
      new Request(new URL(routes.docs.chapter.href({ chapter: 'start-here' }), 'http://localhost')),
    )
    let html = await response.text()

    assert.match(html, /<link rel="alternate" type="text\/markdown" href="\/start-here\.md"/)
  })

  it('serves chapter markdown source', async () => {
    let router = createGuidesRouter()
    let response = await router.fetch(
      new Request(
        new URL(routes.docs.markdown.href({ chapter: 'start-here' }), 'http://localhost'),
      ),
    )
    let markdown = await response.text()

    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Type') ?? '', /^text\/markdown/)
    assert.match(markdown, /^---\ntitle: Start Here\n/)
    assert.match(markdown, /## What is Remix\?/)
  })

  it('inlines demo source in place of frames in chapter markdown', async () => {
    let router = createGuidesRouter()
    let response = await router.fetch(
      new Request(
        new URL(routes.docs.markdown.href({ chapter: 'rendering-ui' }), 'http://localhost'),
      ),
    )
    let markdown = await response.text()

    assert.doesNotMatch(markdown, /^::frame/m)
    assert.match(markdown, /^```tsx\n[^`]*export function ButtonBasic\(/m)
  })

  it('drops preview-only frames whose source is already in the chapter', async () => {
    let router = createGuidesRouter()
    let response = await router.fetch(
      new Request(
        new URL(routes.docs.markdown.href({ chapter: 'interactivity' }), 'http://localhost'),
      ),
    )
    let markdown = await response.text()

    assert.doesNotMatch(markdown, /^::frame/m)
    assert.doesNotMatch(markdown, /\/examples\/05-interactivity\/basic-counter\//)
  })

  it('returns 404 for unknown chapter markdown', async () => {
    let router = createGuidesRouter()
    let response = await router.fetch(
      new Request(new URL(routes.docs.markdown.href({ chapter: 'missing' }), 'http://localhost')),
    )

    assert.equal(response.status, 404)
  })
})

function getOpeningTag(html: string, tagName: string, className: string): string {
  let match = new RegExp(`<${tagName}[^>]*class="${className}"[^>]*>`).exec(html)
  if (!match) throw new Error(`Missing ${tagName}.${className}`)
  return match[0]
}

function getTagById(html: string, tagName: string, id: string): string {
  let match = new RegExp(`<${tagName}[^>]*id="${id}"[^>]*>`).exec(html)
  if (!match) throw new Error(`Missing ${tagName}#${id}`)
  return match[0]
}

function getChapterNavigationHtml(html: string): string {
  let match = /<nav id="docs-navigation".*?<\/nav>/s.exec(html)
  if (!match) throw new Error('Missing chapter navigation')
  return match[0]
}
