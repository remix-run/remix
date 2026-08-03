import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createAssetServer } from './assets.ts'
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
    assert.equal(html.includes('href="/assets/styles/docs.css"'), true)
    assert.equal(html.includes('/assets/docs-shared/ui/docs-shell.browser.tsx'), true)
    assert.equal(html.includes('src="/v1.2.3/assets/client/entry.tsx"'), false)
    assert.equal(html.includes('href="/v1.2.3/assets/client/entry.tsx"'), false)
  })

  it('keeps persistent stylesheets after variable head content', async (t) => {
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
    let entryPreloadIndex = html.indexOf('rel="modulepreload" href="/assets/client/entry.tsx"')
    let pagefindStylesIndex = html.indexOf(
      'data-key="docs-pagefind-stylesheet" href="/assets/pagefind/pagefind-component-ui.css"',
    )
    let docsStylesIndex = html.indexOf(
      'data-key="docs-stylesheet" rel="stylesheet" href="/assets/styles/docs.css"',
    )

    let entryScriptIndex = html.indexOf(
      'data-key="docs-client-entry" type="module" src="/assets/client/entry.tsx"',
    )
    let pagefindScriptIndex = html.indexOf('data-key="docs-pagefind-client-entry"')

    assert.equal(entryPreloadIndex >= 0, true)
    assert.equal(pagefindStylesIndex > entryPreloadIndex, true)
    assert.equal(docsStylesIndex > pagefindStylesIndex, true)
    assert.equal(entryScriptIndex > docsStylesIndex, true)
    assert.equal(pagefindScriptIndex > entryScriptIndex, true)
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

  it('serves site-specific and shared static assets at root URLs', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createRouter({
      assetServer,
      versions: ['v1.2.3'],
    })

    let [siteResponse, sharedResponse] = await Promise.all([
      router.fetch(new Request('http://localhost/favicon.ico')),
      router.fetch(new Request('http://localhost/favicon.svg')),
    ])

    assert.equal(siteResponse.status, 200)
    assert.equal((await siteResponse.arrayBuffer()).byteLength > 0, true)
    assert.equal(sharedResponse.status, 200)
    assert.match(sharedResponse.headers.get('Content-Type') ?? '', /image\/svg\+xml/)
    assert.match(await sharedResponse.text(), /<svg width="144"/)
  })

  it('serves dotted version routes only for configured versions', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createRouter({
      assetServer,
      docsContext: await getTestDocsContext(assetServer),
      versions: ['v1.2.3'],
    })

    let configured = await router.fetch(new Request('http://localhost/v1.2.3/'))
    assert.equal(configured.status, 200)

    let encoded = await router.fetch(new Request('http://localhost/v1%2E2%2E3/'))
    assert.equal(encoded.status, 404)

    let unknown = await router.fetch(new Request('http://localhost/v9.9.9/'))
    assert.equal(unknown.status, 404)
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
    url === '/favicon.ico' ||
    url === '/favicon.svg' ||
    url === '/remix-logo-light-mode.svg' ||
    url === '/remix-wordmark-light-mode.svg'
  ) {
    return false
  }
  return true
}

async function getTestDocsContext(assetServer: ReturnType<typeof createAssetServer>) {
  let [entryHref, entryPreloads, stylesheetHref, stylesheetPreloads] = await Promise.all([
    assetServer.getHref('docs/api/src/client/entry.tsx'),
    assetServer.getPreloads('docs/api/src/client/entry.tsx'),
    assetServer.getHref('docs/api/src/styles/docs.css'),
    assetServer.getPreloads('docs/api/src/styles/docs.css'),
  ])

  return {
    docFiles: [],
    docFilesLookup: new Map(),
    entryHref,
    entryPreloads,
    stylesheetHref,
    stylesheetPreloads,
    getRegistry() {
      return buildRegistry([])
    },
  }
}

describe('getVersionedLookupHref()', () => {
  it('preserves dots in versioned markdown lookup targets', () => {
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
