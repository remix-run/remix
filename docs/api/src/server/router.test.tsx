import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createAssetServer } from './asset-server.ts'
import { getVersionedLookupHref } from './lookup.ts'
import { buildRegistry } from './registry.ts'
import { createRouter } from './router.tsx'
import { getApiRouteHref } from './routes.ts'

describe('createRouter()', () => {
  it('does not load generated docs output while creating the router', (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createRouter({
      assetServer,
      versions: ['v1.2.3'],
    })
    assert.equal(typeof router.fetch, 'function')
  })

  it('uses root asset URLs when no asset version is configured', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createRouter({
      assetServer,
      docsContext: await getTestDocsContext(assetServer),
      versions: ['v1.2.3'],
    })

    let response = await router.fetch(new Request('http://localhost/'))
    assert.equal(response.status, 200)
    let html = await response.text()

    assert.equal(html.includes('src="/assets/client/entry.tsx"'), true)
    assert.equal(html.includes('href="/assets/client/entry.tsx"'), true)
    assert.equal(html.includes('href="/assets/client/table-of-contents.browser.tsx"'), true)
    assert.equal(html.includes('href="/assets/client/table-of-contents-active.browser.ts"'), true)
    assert.equal(html.includes('/assets/docs-shared/ui/docs-shell.browser.tsx'), true)
    assert.equal(html.includes('src="/v1.2.3/assets/client/entry.tsx"'), false)
    assert.equal(html.includes('href="/v1.2.3/assets/client/entry.tsx"'), false)
  })

  it('loads docs styles after Pagefind styles so theme overrides win', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createRouter({
      assetServer,
      docsContext: await getTestDocsContext(assetServer),
      versions: ['v1.2.3'],
    })

    let response = await router.fetch(new Request('http://localhost/'))
    assert.equal(response.status, 200)
    let html = await response.text()
    let pagefindStylesIndex = html.indexOf('href="/assets/pagefind/pagefind-component-ui.css"')
    let docsStylesIndex = html.indexOf('href="/docs.css"')

    assert.equal(pagefindStylesIndex >= 0, true)
    assert.equal(docsStylesIndex > pagefindStylesIndex, true)
  })

  it('uses versioned asset URLs when an asset version is configured', async (t) => {
    let assetServer = createAssetServer('v1.2.3')
    t.after(() => assetServer.close())
    let router = createRouter({
      assetServer,
      docsContext: await getTestDocsContext(assetServer),
      versions: ['v1.2.3'],
    })

    let response = await router.fetch(new Request('http://localhost/v1.2.3/'))
    assert.equal(response.status, 200)
    let html = await response.text()
    let assetUrls = getLoadedAssetUrls(html).filter((url) => shouldVersionAssetUrl(url))

    assert.equal(html.includes('src="/v1.2.3/assets/client/entry.tsx"'), true)
    assert.equal(html.includes('href="/v1.2.3/assets/client/entry.tsx"'), true)
    assert.equal(html.includes('/v1.2.3/assets/docs-shared/ui/docs-shell.browser.tsx'), true)
    assert.equal(html.includes('src="/assets/client/entry.tsx"'), false)
    assert.equal(html.includes('href="/assets/client/entry.tsx"'), false)
    assert.equal(assetUrls.length > 0, true)
    assert.deepEqual(
      assetUrls.filter((url) => !url.startsWith('/v1.2.3/')),
      [],
    )
  })

  it('serves only the configured asset URL space', async (t) => {
    let assetServer = createAssetServer('v1.2.3')
    t.after(() => assetServer.close())
    let router = createRouter({
      assetServer,
      versions: ['v1.2.3'],
    })

    let versionedResponse = await router.fetch(
      new Request('http://localhost/v1.2.3/assets/client/entry.tsx'),
    )
    assert.equal(versionedResponse.status, 200)

    let rootResponse = await router.fetch(new Request('http://localhost/assets/client/entry.tsx'))
    assert.equal(rootResponse.status, 404)
  })
})

function getLoadedAssetUrls(html: string): string[] {
  let urls: string[] = []
  let tagPattern = /<(?:link|script|img)\b[^>]*>/g
  let urlPattern = /\b(?:href|src)="([^"]+)"/

  for (let tag of html.matchAll(tagPattern)) {
    let url = tag[0].match(urlPattern)?.[1]
    if (url) urls.push(url)
  }

  return urls
}

function shouldVersionAssetUrl(url: string): boolean {
  if (!url.startsWith('/')) return false
  if (
    url === '/docs.css' ||
    url === '/favicon.ico' ||
    url === '/favicon.svg' ||
    url === '/remix-logo-light-mode.svg' ||
    url === '/remix-wordmark-light-mode.svg' ||
    url === '/remix-wordmark-dark-mode.svg'
  ) {
    return false
  }
  return true
}

async function getTestDocsContext(assetServer: ReturnType<typeof createAssetServer>) {
  let [entryHref, entryPreloads, tableOfContentsEntryHref, tableOfContentsEntryPreloads] =
    await Promise.all([
      assetServer.getHref('docs/api/src/client/entry.tsx'),
      assetServer.getPreloads('docs/api/src/client/entry.tsx'),
      assetServer.getHref('docs/api/src/client/table-of-contents.browser.tsx'),
      assetServer.getPreloads('docs/api/src/client/table-of-contents.browser.tsx'),
    ])

  return {
    docFiles: [],
    docFilesLookup: new Map(),
    entryHref,
    entryPreloads: [...new Set([...entryPreloads, ...tableOfContentsEntryPreloads])],
    tableOfContentsEntryHref,
    getRegistry() {
      return buildRegistry([])
    },
  }
}

describe('getVersionedLookupHref()', () => {
  it('preserves versioned markdown lookup targets', () => {
    assert.equal(
      getVersionedLookupHref('/api/remix/headers/accept/class/Accept.md', 'v1.2.3'),
      '/v1.2.3/api/remix/headers/accept/class/Accept.md',
    )
  })

  it('uses docs routes for HTML lookup targets', () => {
    assert.equal(
      getVersionedLookupHref('/api/remix/headers/accept/class/Accept', 'v1.2.3'),
      '/v1.2.3/api/remix/headers/accept/class/Accept/',
    )
  })

  it('preserves query strings and hashes', () => {
    assert.equal(
      getVersionedLookupHref(
        '/api/remix/headers/accept/class/Accept.md?tab=docs#example',
        'v1.2.3',
      ),
      '/v1.2.3/api/remix/headers/accept/class/Accept.md?tab=docs#example',
    )
  })

  it('leaves non-API lookup targets unchanged', () => {
    assert.equal(
      getVersionedLookupHref('https://example.com/Accept', 'v1.2.3'),
      'https://example.com/Accept',
    )
  })
})

describe('getApiRouteHref()', () => {
  it('returns undefined for non-API hrefs', () => {
    assert.equal(getApiRouteHref('https://example.com/Accept', 'v1.2.3'), undefined)
  })

  it('preserves unversioned docs hrefs when version is undefined', () => {
    assert.equal(
      getApiRouteHref('/api/remix/headers/accept/class/Accept.md?tab=docs#example', undefined),
      '/api/remix/headers/accept/class/Accept.md?tab=docs#example',
    )
  })
})
