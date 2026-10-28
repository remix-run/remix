import * as assert from 'remix/assert'
import { describe, it, type TestContext } from 'remix/test'

import { buildRegistry } from '../../data/registry.ts'
import { createDocsRouter } from '../../router.ts'
import { routes } from '../../routes.ts'
import { createAssetServer } from '../../assets.ts'
import { loadDocsNavigationItems } from './markdown-chapters.tsx'

const guideNavigation = await loadDocsNavigationItems()

describe('docs responses', () => {
  it('shows unfinished chapters with links to package READMEs', async (t) => {
    let router = createTestRouter(t)
    let response = await router.fetch(
      new Request(
        new URL(
          routes.guides.chapter.href({ chapter: 'auth-sessions-security' }),
          'http://localhost',
        ),
      ),
    )
    let html = await response.text()

    assert.equal(response.status, 200)
    assert.match(html, /This chapter is unfinished\./)
    assert.match(
      html,
      /https:\/\/github\.com\/remix-run\/remix\/blob\/main\/packages\/session\/README\.md/,
    )
  })

  it('configures Pagefind around the searchable docs content', async (t) => {
    let router = createTestRouter(t)
    let response = await router.fetch(
      new Request(
        new URL(routes.guides.chapter.href({ chapter: 'start-here' }), 'http://localhost'),
      ),
    )
    let html = await response.text()

    assert.match(html, /<main[^>]*data-pagefind-body/)
    assert.match(html, /href="\/_assets\/pagefind\/pagefind-component-ui\.css"/)
    assert.match(html, /src="\/_assets\/pagefind\/pagefind-component-ui\.js"/)
    assert.match(html, /<pagefind-config base-url="\/" bundle-path="\/_assets\/pagefind\/">/)
    assert.match(html, /<pagefind-modal[^>]*data-rmx-preserve-dom[^>]*reset-on-close/)
    assert.match(html, /\/_assets\/docs-shared\/ui\/public\/docs-shell\.tsx/)
  })

  it('excludes docs navigation chrome from the Pagefind index', async (t) => {
    let router = createTestRouter(t)
    let response = await router.fetch(
      new Request(
        new URL(routes.guides.chapter.href({ chapter: 'start-here' }), 'http://localhost'),
      ),
    )
    let html = await response.text()

    assert.match(getOpeningTag(html, 'nav', 'docs-pagination'), /data-pagefind-ignore/)
    assert.match(getTagById(html, 'aside', 'docs-secondary-navigation'), /data-pagefind-ignore/)
  })

  it('marks exactly one chapter current on a chapter response', async (t) => {
    let router = createTestRouter(t)
    let response = await router.fetch(
      new Request(
        new URL(routes.guides.chapter.href({ chapter: 'start-here' }), 'http://localhost'),
      ),
    )
    let html = await response.text()

    assert.equal(response.status, 200)
    let docsNavigation = getDocsNavigationHtml(html)
    assert.equal(docsNavigation.match(/aria-current="page"/g)?.length, 1)
    assert.match(docsNavigation, /href="\/"[^>]*>Introduction<\/a>/)
    assert.doesNotMatch(docsNavigation, />Guides<\/h2>/)
    assert.match(docsNavigation, /href="\/start-here\/" aria-current="page"/)
    assert.match(docsNavigation, /href="\/api\/"[^>]*>API Reference/)
    assert.match(
      getOpeningTag(html, 'div', 'docs-layout'),
      /data-rmx-key="docs-chapter-start-here"/,
    )
    assert.match(html, /\/_assets\/docs-shared\/ui\/public\/code-block-copy\.tsx/)
  })

  it('links chapter pages to their markdown source', async (t) => {
    let router = createTestRouter(t)
    let response = await router.fetch(
      new Request(
        new URL(routes.guides.chapter.href({ chapter: 'start-here' }), 'http://localhost'),
      ),
    )
    let html = await response.text()

    assert.match(html, /<link rel="alternate" type="text\/markdown" href="\/start-here\.md"/)
  })

  it('serves chapter markdown source', async (t) => {
    let router = createTestRouter(t)
    let response = await router.fetch(
      new Request(
        new URL(routes.guides.markdown.href({ chapter: 'start-here' }), 'http://localhost'),
      ),
    )
    let markdown = await response.text()

    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Type') ?? '', /^text\/markdown/)
    assert.match(markdown, /^---\ntitle: Getting Started\n/)
    assert.match(markdown, /## What is Remix\?/)
  })

  it('inlines demo source in place of frames in chapter markdown', async (t) => {
    let router = createTestRouter(t)
    let response = await router.fetch(
      new Request(
        new URL(routes.guides.markdown.href({ chapter: 'rendering-ui' }), 'http://localhost'),
      ),
    )
    let markdown = await response.text()

    assert.doesNotMatch(markdown, /^::frame/m)
    assert.match(markdown, /^```tsx\n[^`]*export function AccordionPrimitives\(/m)
  })

  it('drops preview-only frames whose source is already in the chapter', async (t) => {
    let router = createTestRouter(t)
    let response = await router.fetch(
      new Request(
        new URL(routes.guides.markdown.href({ chapter: 'interactivity' }), 'http://localhost'),
      ),
    )
    let markdown = await response.text()

    assert.doesNotMatch(markdown, /^::frame/m)
    assert.doesNotMatch(markdown, /\/examples\/05-interactivity\/basic-counter\//)
  })

  it('returns 404 for unknown chapter markdown', async (t) => {
    let router = createTestRouter(t)
    let response = await router.fetch(
      new Request(new URL(routes.guides.markdown.href({ chapter: 'missing' }), 'http://localhost')),
    )

    assert.equal(response.status, 404)
  })
})

function createTestRouter(t: TestContext) {
  let assetServer = createAssetServer()
  t.after(() => assetServer.close())
  return createDocsRouter({
    assetServer,
    docsContext: {
      docFiles: [],
      docFilesLookup: new Map(),
      registry: buildRegistry([], guideNavigation),
    },
  })
}

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

function getDocsNavigationHtml(html: string): string {
  let match = /<nav id="docs-navigation".*?<\/nav>/s.exec(html)
  if (!match) throw new Error('Missing docs navigation')
  return match[0]
}
