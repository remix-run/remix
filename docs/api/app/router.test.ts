import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { getVersionedLookupHref } from './data/lookup.ts'
import { buildRegistry, type DocFile } from './data/registry.ts'
import { createApiRouter } from './router.ts'
import { getApiRouteHref } from './routes.ts'
import { createAssetServer } from './assets.ts'
describe('createApiRouter()', () => {
  it('does not load generated docs output while creating the router', (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createApiRouter({
      assetServer,
      versions: ['v1.2.3'],
    })
    assert.equal(typeof router.fetch, 'function')
  })

  it('uses root asset URLs when no asset version is configured', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createApiRouter({
      assetServer,
      docsContext: await getTestDocsContext(),
      versions: ['v1.2.3'],
    })

    let response = await router.fetch(new Request('http://localhost/'))
    assert.equal(response.status, 200)
    let html = await response.text()

    assert.equal(html.includes('src="/assets/app/actions/public/entry.tsx"'), true)
    assert.equal(html.includes('href="/assets/app/actions/public/entry.tsx"'), true)
    assert.equal(html.includes('href="/assets/app/actions/public/docs.css"'), true)
    assert.equal(html.includes('/assets/docs-shared/ui/public/docs-shell.tsx'), true)
    assert.equal(html.includes('/assets/docs-shared/ui/public/code-block-copy.tsx'), true)
    assert.equal(html.includes('src="/v1.2.3/assets/app/actions/public/entry.tsx"'), false)
    assert.equal(html.includes('href="/v1.2.3/assets/app/actions/public/entry.tsx"'), false)
  })

  it('keeps persistent stylesheets after variable head content', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createApiRouter({
      assetServer,
      docsContext: await getTestDocsContext(),
      versions: ['v1.2.3'],
    })

    let response = await router.fetch(new Request('http://localhost/'))
    assert.equal(response.status, 200)
    let html = await response.text()
    let entryPreloadIndex = html.indexOf(
      'rel="modulepreload" href="/assets/app/actions/public/entry.tsx"',
    )
    let pagefindStylesIndex = html.indexOf(
      'data-rmx-key="docs-pagefind-stylesheet" href="/assets/pagefind/pagefind-component-ui.css"',
    )
    let docsStylesIndex = html.indexOf(
      'data-rmx-key="docs-stylesheet" rel="stylesheet" href="/assets/app/actions/public/docs.css"',
    )
    let importMapIndex = html.indexOf('type="importmap"')

    let entryScriptIndex = html.indexOf(
      'data-rmx-key="docs-client-entry" type="module" src="/assets/app/actions/public/entry.tsx"',
    )
    let pagefindScriptIndex = html.indexOf('data-rmx-key="docs-pagefind-client-entry"')

    assert.equal(pagefindStylesIndex >= 0, true)
    assert.equal(docsStylesIndex > pagefindStylesIndex, true)
    assert.equal(importMapIndex > docsStylesIndex, true)
    assert.equal(entryPreloadIndex > importMapIndex, true)
    assert.equal(entryScriptIndex > entryPreloadIndex, true)
    assert.equal(pagefindScriptIndex > entryScriptIndex, true)
  })

  it('uses versioned asset URLs when an asset version is configured', async (t) => {
    let assetServer = createAssetServer('v1.2.3')
    t.after(() => assetServer.close())
    let router = createApiRouter({
      assetServer,
      docsContext: await getTestDocsContext(),
      versions: ['v1.2.3'],
    })

    let response = await router.fetch(new Request('http://localhost/v1.2.3/'))
    assert.equal(response.status, 200)
    let html = await response.text()
    let assetUrls = getLoadedAssetUrls(html).filter((url) => shouldVersionAssetUrl(url))

    assert.equal(html.includes('src="/v1.2.3/assets/app/actions/public/entry.tsx"'), true)
    assert.equal(html.includes('href="/v1.2.3/assets/app/actions/public/entry.tsx"'), true)
    assert.equal(html.includes('/v1.2.3/assets/docs-shared/ui/public/docs-shell.tsx'), true)
    assert.equal(html.includes('/v1.2.3/assets/docs-shared/ui/public/code-block-copy.tsx'), true)
    assert.equal(html.includes('src="/assets/app/actions/public/entry.tsx"'), false)
    assert.equal(html.includes('href="/assets/app/actions/public/entry.tsx"'), false)
    assert.equal(assetUrls.length > 0, true)
    assert.deepEqual(
      assetUrls.filter((url) => !url.startsWith('/v1.2.3/')),
      [],
    )
  })

  it('serves site-specific and shared static assets at root URLs', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createApiRouter({
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
    let router = createApiRouter({
      assetServer,
      docsContext: await getTestDocsContext(),
      versions: ['v1.2.3'],
    })

    let configured = await router.fetch(new Request('http://localhost/v1.2.3/'))
    assert.equal(configured.status, 200)

    let encoded = await router.fetch(new Request('http://localhost/v1%2E2%2E3/'))
    assert.equal(encoded.status, 404)

    let unknown = await router.fetch(new Request('http://localhost/v9.9.9/'))
    assert.equal(unknown.status, 404)
  })

  it('maps API document actions at root and versioned paths', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createApiRouter({
      assetServer,
      docsContext: await getTestDocsContext(),
      versions: ['v1.2.3'],
    })

    let [rootResponse, versionedResponse] = await Promise.all([
      router.fetch(new Request('http://localhost/missing/')),
      router.fetch(new Request('http://localhost/v1.2.3/missing/')),
    ])

    assert.equal(rootResponse.status, 404)
    assert.match(await rootResponse.text(), /Could not find a document at:/)
    assert.equal(versionedResponse.status, 404)
    assert.match(await versionedResponse.text(), /Could not find a document at:/)
  })

  it('forwards legacy /api/ URLs to the root docs URLs', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createApiRouter({
      assetServer,
      docsContext: await getTestDocsContext(),
      versions: ['v1.2.3'],
    })

    let [page, versionedPage, markdown] = await Promise.all([
      router.fetch(new Request('http://localhost/api/@remix-run/ui/tabs/overview/')),
      router.fetch(new Request('http://localhost/v1.2.3/api/remix/router/overview/')),
      router.fetch(new Request('http://localhost/api/remix/router/overview.md')),
    ])

    assert.equal(page.status, 200)
    assert.match(await page.text(), /http-equiv="refresh" content="0; url=\/remix-run\/ui\/tabs\/"/)
    assert.match(
      await versionedPage.text(),
      /http-equiv="refresh" content="0; url=\/v1\.2\.3\/remix\/router\/"/,
    )
    assert.equal(markdown.status, 301)
    assert.equal(markdown.headers.get('Location'), '/remix/router.md')
  })

  it('serves only the configured asset URL space', async (t) => {
    let assetServer = createAssetServer('v1.2.3')
    t.after(() => assetServer.close())
    let router = createApiRouter({
      assetServer,
      versions: ['v1.2.3'],
    })

    let versionedResponse = await router.fetch(
      new Request('http://localhost/v1.2.3/assets/app/actions/public/entry.tsx'),
    )
    assert.equal(versionedResponse.status, 200)

    let [rootResponse, privateResponse] = await Promise.all([
      router.fetch(new Request('http://localhost/assets/app/actions/public/entry.tsx')),
      router.fetch(new Request('http://localhost/v1.2.3/assets/app/actions/controller.tsx')),
    ])
    assert.equal(rootResponse.status, 404)
    assert.equal(privateResponse.status, 404)
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

async function getTestDocsContext() {
  return {
    docFiles: [],
    docFilesLookup: new Map(),
    getRegistry() {
      return buildRegistry([])
    },
  }
}

describe('getVersionedLookupHref()', () => {
  it('preserves dots in versioned markdown lookup targets', () => {
    assert.equal(
      getVersionedLookupHref('/remix/headers/accept/class/Accept.md', 'v1.2.3'),
      '/v1.2.3/remix/headers/accept/class/Accept.md',
    )
  })

  it('uses docs routes for HTML lookup targets', () => {
    assert.equal(
      getVersionedLookupHref('/remix/headers/accept/class/Accept', 'v1.2.3'),
      '/v1.2.3/remix/headers/accept/class/Accept/',
    )
  })

  it('preserves query strings and hashes', () => {
    assert.equal(
      getVersionedLookupHref('/remix/headers/accept/class/Accept.md?tab=docs#example', 'v1.2.3'),
      '/v1.2.3/remix/headers/accept/class/Accept.md?tab=docs#example',
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
      getApiRouteHref('/remix/headers/accept/class/Accept.md?tab=docs#example', undefined),
      '/remix/headers/accept/class/Accept.md?tab=docs#example',
    )
  })

  it('rewrites legacy /api/ hrefs to root docs hrefs', () => {
    assert.equal(
      getApiRouteHref('/api/@remix-run/ui/tabs/overview', 'v1.2.3'),
      '/v1.2.3/remix-run/ui/tabs/',
    )
  })

  it('keeps overview segments in current docs hrefs', () => {
    assert.equal(
      getApiRouteHref('/remix/example/function/overview', undefined),
      '/remix/example/function/overview/',
    )
  })
})

describe('buildRegistry()', () => {
  it('groups import paths under their top-level package', () => {
    let registry = buildRegistry([
      packageFile('remix/data-table'),
      packageFile('remix/data-table/mysql'),
      apiFile('remix/data-table', 'function', 'query'),
      apiFile('remix/data-table', 'class', 'Database'),
      apiFile('remix/data-table/mysql', 'function', 'createMysqlDatabase'),
      packageFile('remix/middleware/cors'),
      packageFile('remix'),
    ])

    assert.deepEqual(
      registry.packages.map((navPackage) => [
        navPackage.id,
        navPackage.homePageId,
        navPackage.subpackages.map((subpackage) => [subpackage.label, subpackage.pageIds]),
      ]),
      [
        [
          'data-table',
          'remix/data-table',
          [
            ['data-table', ['remix/data-table/class/Database', 'remix/data-table/function/query']],
            ['data-table/mysql', ['remix/data-table/mysql/function/createMysqlDatabase']],
          ],
        ],
        ['middleware', 'remix/middleware', [['middleware/cors', []]]],
      ],
    )
    assert.equal(registry.pages['remix/middleware'].path, '/remix/middleware/')
    assert.equal(registry.pages.remix.packageId, undefined)
  })
})

function packageFile(pkg: string): DocFile {
  return {
    kind: 'package',
    path: '',
    type: 'package',
    name: pkg,
    package: pkg,
    urlPath: pkg,
  }
}

function apiFile(pkg: string, type: 'class' | 'function', name: string): DocFile {
  return { kind: 'api', path: '', type, name, package: pkg, urlPath: `${pkg}/${type}/${name}` }
}
