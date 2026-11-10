import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { buildRegistry, getNavChain, type DocFile, type NavNode } from './data/registry.ts'
import { loadDocsNavigationItems } from './actions/guides/markdown-chapters.tsx'
import { createDocsRouter } from './router.ts'
import { getApiRouteHref, getDocsUrlPath } from './routes.ts'
import { createAssetServer } from './assets.ts'
describe('createDocsRouter()', () => {
  it('does not load generated docs output while creating the router', (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createDocsRouter({
      assetServer,
    })
    assert.equal(typeof router.fetch, 'function')
  })

  it('uses root asset URLs', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createDocsRouter({
      assetServer,
      docsContext: await getTestDocsContext(),
    })

    let response = await router.fetch(new Request('http://localhost/'))
    assert.equal(response.status, 200)
    let html = await response.text()

    assert.equal(html.includes('src="/_assets/app/actions/public/entry.tsx"'), true)
    assert.equal(html.includes('href="/_assets/app/actions/public/entry.tsx"'), true)
    assert.equal(html.includes('href="/_assets/app/actions/public/docs.css"'), true)
    assert.equal(html.includes('/_assets/docs-shared/ui/public/docs-shell.tsx'), true)
    assert.equal(html.includes('/_assets/docs-shared/ui/public/code-block-copy.tsx'), true)
  })

  it('lists guides, then a separate API reference row, in the main navigation', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let guides = await loadDocsNavigationItems()
    let router = createDocsRouter({
      assetServer,
      docsContext: {
        docFiles: [],
        docFilesLookup: new Map(),
        registry: buildRegistry([packageFile('remix/data-table')], guides),
      },
    })

    let response = await router.fetch(new Request('http://localhost/'))
    assert.equal(response.status, 200)
    let html = await response.text()
    let firstGuideIndex = html.indexOf('href="/start-here/"')
    let apiReferenceIndex = html.indexOf('>API Reference')

    assert.match(html, /<title[^>]*>Introduction \| Remix Docs<\/title>/)
    assert.match(html, /href="\/" aria-current="page"[^>]*>Introduction<\/a>/)
    assert.doesNotMatch(html, />Guides<\/h2>/)
    assert.doesNotMatch(html, />Packages<\/h2>/)
    assert.equal(firstGuideIndex >= 0, true)
    assert.equal(apiReferenceIndex > firstGuideIndex, true)
    assert.match(html, /href="\/api\/"[^>]*>API Reference/)
  })

  it('serves the API overview at /api/ with the API reference menu open', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let guides = await loadDocsNavigationItems()
    let router = createDocsRouter({
      assetServer,
      docsContext: {
        docFiles: [],
        docFilesLookup: new Map(),
        registry: buildRegistry([packageFile('remix/data-table')], guides),
      },
    })

    let response = await router.fetch(new Request('http://localhost/api/'))
    assert.equal(response.status, 200)
    let html = await response.text()

    assert.match(html, /<title[^>]*>API Reference \| Remix Docs<\/title>/)
    assert.match(html, /href="\/api\/" aria-current="page"[^>]*>API Reference<\/a>/)
    assert.match(html, /data-api-nav-back[^>]*>.*Docs<\/a>/s)
    assert.match(html, />Packages<\/h2>/)
    assert.match(html, /href="\/api\/data-table\/"[^>]*api-nav-node/)
    assert.match(html, /<h2 id="installation">/)
  })

  it('serves guides at the root and package pages under /api/', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let guides = await loadDocsNavigationItems()
    let router = createDocsRouter({
      assetServer,
      docsContext: {
        docFiles: [],
        docFilesLookup: new Map(),
        registry: buildRegistry([packageFile('remix/data-table')], guides),
      },
    })

    let chapter = await router.fetch(new Request('http://localhost/start-here/'))
    assert.equal(chapter.status, 200)
    assert.match(await chapter.text(), /<title[^>]*>Getting Started/)

    let markdown = await router.fetch(new Request('http://localhost/start-here.md'))
    assert.equal(markdown.status, 200)
    assert.match(markdown.headers.get('Content-Type') ?? '', /text\/markdown/)

    let reference = await router.fetch(new Request('http://localhost/api/data-table/'))
    assert.equal(reference.status, 200)
    assert.match(await reference.text(), /API reference for remix\/data-table/)

    let rootPackage = await router.fetch(new Request('http://localhost/data-table/'))
    assert.equal(rootPackage.status, 404)

    let missing = await router.fetch(new Request('http://localhost/nope.md'))
    assert.equal(missing.status, 404)
  })

  it('keeps guides in the root panel on direct API reference requests', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let guides = await loadDocsNavigationItems()
    let router = createDocsRouter({
      assetServer,
      docsContext: {
        docFiles: [],
        docFilesLookup: new Map(),
        registry: buildRegistry([packageFile('remix/data-table')], guides),
      },
    })

    let response = await router.fetch(new Request('http://localhost/api/data-table/'))
    assert.equal(response.status, 200)
    let html = await response.text()
    let rootPanel = /<div data-api-nav-panel="before"[^>]*>(.*?)<\/div>/s.exec(html)?.[1] ?? ''

    assert.match(html, /data-api-nav-back[^>]*>.*API Reference<\/a>/s)
    assert.match(html, /href="\/api\/data-table\/" aria-current="page"[^>]*>data-table<\/a>/)
    assert.doesNotMatch(rootPanel, />Guides<\/h2>/)
    assert.match(rootPanel, /href="\/start-here\/"/)
    assert.match(rootPanel, /href="\/api\/"[^>]*>API Reference/)
  })

  it('uses one active Docs link in the primary navigation', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createDocsRouter({
      assetServer,
      docsContext: await getTestDocsContext(),
    })

    let response = await router.fetch(new Request('http://localhost/start-here/'))
    assert.equal(response.status, 200)
    let html = await response.text()
    let primaryNavigation = /<nav aria-label="Primary".*?<\/nav>/s.exec(html)?.[0] ?? ''

    assert.match(primaryNavigation, /href="\/" aria-current="location"[^>]*>Docs<\/a>/)
    assert.equal(primaryNavigation.match(/>Docs<\/a>/g)?.length, 1)
    assert.doesNotMatch(primaryNavigation, />Guides<\/a>/)
  })

  it('keeps persistent stylesheets after variable head content', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createDocsRouter({
      assetServer,
      docsContext: await getTestDocsContext(),
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

  it('serves site-specific and shared static assets at root URLs', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createDocsRouter({
      assetServer,
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

  it('maps API document actions under /api/', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createDocsRouter({
      assetServer,
      docsContext: await getTestDocsContext(),
    })

    let response = await router.fetch(new Request('http://localhost/api/missing/'))

    assert.equal(response.status, 404)
    assert.match(await response.text(), /Could not find a document at:/)
  })

  it('serves only public browser modules from the asset URL space', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createDocsRouter({
      assetServer,
    })

    let [publicResponse, privateResponse] = await Promise.all([
      router.fetch(new Request('http://localhost/_assets/app/actions/public/entry.tsx')),
      router.fetch(new Request('http://localhost/_assets/app/actions/controller.tsx')),
    ])
    assert.equal(publicResponse.status, 200)
    assert.equal(privateResponse.status, 404)
  })

  it('serves an existing prerendered Pagefind asset in development', async (t) => {
    let pagefindAssetsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-docs-pagefind-'))
    t.after(() => void fs.rm(pagefindAssetsDir, { recursive: true, force: true }))
    await fs.writeFile(
      path.join(pagefindAssetsDir, 'pagefind-component-ui.js'),
      'export const search = true\n',
    )
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createDocsRouter({ assetServer, pagefindAssetsDir })

    let response = await router.fetch(
      new Request('http://localhost/_assets/pagefind/pagefind-component-ui.js'),
    )

    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Type') ?? '', /javascript/)
    assert.equal(await response.text(), 'export const search = true\n')
  })

  it('returns no content for a Pagefind asset that has not been prerendered', async (t) => {
    let pagefindAssetsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remix-docs-pagefind-'))
    t.after(() => void fs.rm(pagefindAssetsDir, { recursive: true, force: true }))
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createDocsRouter({ assetServer, pagefindAssetsDir })

    let response = await router.fetch(
      new Request('http://localhost/_assets/pagefind/pagefind-component-ui.js'),
    )

    assert.equal(response.status, 204)
  })
})

async function getTestDocsContext() {
  return {
    docFiles: [],
    docFilesLookup: new Map(),
    registry: buildRegistry([], await loadDocsNavigationItems()),
  }
}

describe('getApiRouteHref()', () => {
  it('returns undefined for non-API hrefs', () => {
    assert.equal(getApiRouteHref('https://example.com/Accept'), undefined)
  })

  it('preserves docs hrefs with files, queries and hashes', () => {
    assert.equal(
      getApiRouteHref('/api/headers/accept/class/Accept.md?tab=docs#example'),
      '/api/headers/accept/class/Accept.md?tab=docs#example',
    )
  })

  it('adds a trailing slash to docs page hrefs', () => {
    assert.equal(getApiRouteHref('/api/ui/tabs'), '/api/ui/tabs/')
  })

  it('maps import-path hrefs to API reference pages', () => {
    assert.equal(getApiRouteHref('/remix/router/type/Route'), '/api/router/type/Route/')
    assert.equal(getApiRouteHref('/remix-run/ui/tabs/'), '/api/ui/tabs/')
    assert.equal(getApiRouteHref('/remix/'), '/api/remix/')
  })

  it('keeps overview segments in current docs hrefs', () => {
    assert.equal(
      getApiRouteHref('/remix/example/function/overview'),
      '/api/example/function/overview/',
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
    assert.equal(registry.pages.middleware.path, '/api/middleware/')
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
    urlPath: getDocsUrlPath(pkg),
  }
}

function apiFile(pkg: string, type: 'class' | 'function' | 'type', name: string): DocFile {
  return {
    kind: 'api',
    path: '',
    type,
    name,
    package: pkg,
    urlPath: getDocsUrlPath(`${pkg}/${type}/${name}`),
  }
}
