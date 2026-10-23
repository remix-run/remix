import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { getVersionedLookupHref } from './data/lookup.ts'
import { buildRegistry, getNavChain, type DocFile, type NavNode } from './data/registry.ts'
import { createApiRouter } from './router.ts'
import { getApiRouteHref, getDocsUrlPath } from './routes.ts'
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

    assert.equal(html.includes('src="/_assets/app/actions/public/entry.tsx"'), true)
    assert.equal(html.includes('href="/_assets/app/actions/public/entry.tsx"'), true)
    assert.equal(html.includes('href="/_assets/app/actions/public/docs.css"'), true)
    assert.equal(html.includes('/_assets/docs-shared/ui/public/docs-shell.tsx'), true)
    assert.equal(html.includes('/_assets/docs-shared/ui/public/code-block-copy.tsx'), true)
    assert.equal(html.includes('src="/v1.2.3/_assets/app/actions/public/entry.tsx"'), false)
    assert.equal(html.includes('href="/v1.2.3/_assets/app/actions/public/entry.tsx"'), false)
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
      'rel="modulepreload" href="/_assets/app/actions/public/entry.tsx"',
    )
    let pagefindStylesIndex = html.indexOf(
      'data-rmx-key="docs-pagefind-stylesheet" href="/_assets/pagefind/pagefind-component-ui.css"',
    )
    let docsStylesIndex = html.indexOf(
      'data-rmx-key="docs-stylesheet" rel="stylesheet" href="/_assets/app/actions/public/docs.css"',
    )
    let importMapIndex = html.indexOf('type="importmap"')

    let entryScriptIndex = html.indexOf(
      'data-rmx-key="docs-client-entry" type="module" src="/_assets/app/actions/public/entry.tsx"',
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

    assert.equal(html.includes('src="/v1.2.3/_assets/app/actions/public/entry.tsx"'), true)
    assert.equal(html.includes('href="/v1.2.3/_assets/app/actions/public/entry.tsx"'), true)
    assert.equal(html.includes('/v1.2.3/_assets/docs-shared/ui/public/docs-shell.tsx'), true)
    assert.equal(html.includes('/v1.2.3/_assets/docs-shared/ui/public/code-block-copy.tsx'), true)
    assert.equal(html.includes('src="/_assets/app/actions/public/entry.tsx"'), false)
    assert.equal(html.includes('href="/_assets/app/actions/public/entry.tsx"'), false)
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

  it('forwards legacy /api/ URLs to the root docs URLs and serves old Markdown URLs', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let directory = fs.mkdtempSync(path.join(os.tmpdir(), 'remix-api-legacy-'))
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
    let overview = packageFile('remix/router')
    overview.path = path.join(directory, 'overview.md')
    fs.writeFileSync(overview.path, '# remix/router\n')
    let router = createApiRouter({
      assetServer,
      docsContext: { ...(await getTestDocsContext()), docFiles: [overview] },
      versions: ['v1.2.3'],
    })

    let [page, versionedPage, markdown] = await Promise.all([
      router.fetch(new Request('http://localhost/api/@remix-run/ui/tabs/overview/')),
      router.fetch(new Request('http://localhost/v1.2.3/api/remix/router/overview/')),
      router.fetch(new Request('http://localhost/api/remix/router/overview.md')),
    ])

    assert.equal(page.status, 200)
    assert.match(await page.text(), /http-equiv="refresh" content="0; url=\/ui\/tabs\/"/)
    assert.match(
      await versionedPage.text(),
      /http-equiv="refresh" content="0; url=\/v1\.2\.3\/router\/"/,
    )
    assert.equal(markdown.status, 200)
    assert.equal(await markdown.text(), '# remix/router\n')
  })

  it('serves only the configured asset URL space', async (t) => {
    let assetServer = createAssetServer('v1.2.3')
    t.after(() => assetServer.close())
    let router = createApiRouter({
      assetServer,
      versions: ['v1.2.3'],
    })

    let versionedResponse = await router.fetch(
      new Request('http://localhost/v1.2.3/_assets/app/actions/public/entry.tsx'),
    )
    assert.equal(versionedResponse.status, 200)

    let [rootResponse, privateResponse] = await Promise.all([
      router.fetch(new Request('http://localhost/_assets/app/actions/public/entry.tsx')),
      router.fetch(new Request('http://localhost/v1.2.3/_assets/app/actions/controller.tsx')),
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
      getVersionedLookupHref('/headers/accept/class/Accept.md', 'v1.2.3'),
      '/v1.2.3/headers/accept/class/Accept.md',
    )
  })

  it('uses docs routes for HTML lookup targets', () => {
    assert.equal(
      getVersionedLookupHref('/headers/accept/class/Accept', 'v1.2.3'),
      '/v1.2.3/headers/accept/class/Accept/',
    )
  })

  it('preserves query strings and hashes', () => {
    assert.equal(
      getVersionedLookupHref('/headers/accept/class/Accept.md?tab=docs#example', 'v1.2.3'),
      '/v1.2.3/headers/accept/class/Accept.md?tab=docs#example',
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
      getApiRouteHref('/headers/accept/class/Accept.md?tab=docs#example', undefined),
      '/headers/accept/class/Accept.md?tab=docs#example',
    )
  })

  it('adds the version and trailing slash to docs page hrefs', () => {
    assert.equal(getApiRouteHref('/ui/tabs', 'v1.2.3'), '/v1.2.3/ui/tabs/')
    assert.equal(getApiRouteHref('/v1.2.3/ui/tabs/', 'v1.2.3'), '/v1.2.3/ui/tabs/')
  })

  it('drops the scope from import-path hrefs', () => {
    assert.equal(getApiRouteHref('/remix/router/type/Route', undefined), '/router/type/Route/')
    assert.equal(getApiRouteHref('/remix-run/ui/tabs/', undefined), '/ui/tabs/')
    assert.equal(getApiRouteHref('/remix/', undefined), '/remix/')
  })

  it('rewrites legacy /api/ hrefs to root docs hrefs', () => {
    assert.equal(getApiRouteHref('/api/@remix-run/ui/tabs/overview', 'v1.2.3'), '/v1.2.3/ui/tabs/')
    assert.equal(getApiRouteHref('/api/remix/overview.md', undefined), '/remix.md')
    assert.equal(getApiRouteHref('/api/remix/overview/', undefined), '/remix/')
  })

  it('keeps overview segments in current docs hrefs', () => {
    assert.equal(
      getApiRouteHref('/remix/example/function/overview', undefined),
      '/example/function/overview/',
    )
  })
})

describe('buildRegistry()', () => {
  it('nests import paths into menus and lists runtime exports before types', () => {
    let registry = buildRegistry([
      packageFile('remix/data-table'),
      packageFile('remix/data-table/migrations'),
      packageFile('remix/data-table/migrations/node'),
      packageFile('remix/data-table/mysql'),
      apiFile('remix/data-table', 'function', 'query'),
      apiFile('remix/data-table', 'class', 'Database'),
      apiFile('remix/data-table', 'type', 'AnyTable'),
      packageFile('remix/middleware/cors'),
      packageFile('remix'),
    ])

    assert.deepEqual(registry.packages.map(summarizeNavNode), [
      {
        label: 'data-table',
        home: 'data-table',
        pages: [
          'data-table/class/Database',
          'data-table/function/query',
          'data-table/type/AnyTable',
        ],
        children: [
          {
            label: 'data-table/migrations',
            home: 'data-table/migrations',
            pages: [],
            children: [
              {
                label: 'data-table/migrations/node',
                home: 'data-table/migrations/node',
                pages: [],
                children: [],
              },
            ],
          },
          { label: 'data-table/mysql', home: 'data-table/mysql', pages: [], children: [] },
        ],
      },
      {
        label: 'middleware',
        home: 'middleware',
        pages: [],
        children: [{ label: 'middleware/cors', home: 'middleware/cors', pages: [], children: [] }],
      },
    ])
    assert.equal(registry.pages.middleware.path, '/middleware/')
    assert.deepEqual(
      getNavChain(registry, registry.pages['data-table/migrations/node'].navId).map(
        (node) => node.label,
      ),
      ['data-table', 'data-table/migrations', 'data-table/migrations/node'],
    )
    assert.equal(registry.pages.remix.navId, undefined)
  })
})

describe('sidebar labels', () => {
  it('shows functions as calls and components as elements', () => {
    let registry = buildRegistry([
      apiFile('remix/component', 'function', 'css'),
      apiFile('remix/component', 'function', 'Frame'),
      apiFile('remix/component', 'class', 'Database'),
    ])

    assert.equal(registry.pages['component/function/css'].navLabel, 'css()')
    assert.equal(registry.pages['component/function/Frame'].navLabel, '<Frame>')
    assert.equal(registry.pages['component/class/Database'].navLabel, 'Database')
  })
})

type NavNodeSummary = { label: string; home: string; pages: string[]; children: NavNodeSummary[] }

function summarizeNavNode(node: NavNode): NavNodeSummary {
  return {
    label: node.label,
    home: node.homePageId,
    pages: node.pageIds,
    children: node.children.map(summarizeNavNode),
  }
}

function packageFile(pkg: string): DocFile {
  return {
    kind: 'package',
    path: '',
    type: 'package',
    name: pkg,
    package: pkg,
    docsPath: pkg,
    urlPath: getDocsUrlPath(pkg),
  }
}

function apiFile(pkg: string, type: 'class' | 'function' | 'type', name: string): DocFile {
  let docsPath = `${pkg}/${type}/${name}`
  return {
    kind: 'api',
    path: '',
    type,
    name,
    package: pkg,
    docsPath,
    urlPath: getDocsUrlPath(docsPath),
  }
}
