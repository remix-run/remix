import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

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
    })
    assert.equal(typeof router.fetch, 'function')
  })

  it('uses root asset URLs', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createApiRouter({
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

  it('keeps persistent stylesheets after variable head content', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createApiRouter({
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
    let router = createApiRouter({
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

  it('maps API document actions at root paths', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createApiRouter({
      assetServer,
      docsContext: await getTestDocsContext(),
    })

    let response = await router.fetch(new Request('http://localhost/missing/'))

    assert.equal(response.status, 404)
    assert.match(await response.text(), /Could not find a document at:/)
  })

  it('serves only public browser modules from the asset URL space', async (t) => {
    let assetServer = createAssetServer()
    t.after(() => assetServer.close())
    let router = createApiRouter({
      assetServer,
    })

    let [publicResponse, privateResponse] = await Promise.all([
      router.fetch(new Request('http://localhost/_assets/app/actions/public/entry.tsx')),
      router.fetch(new Request('http://localhost/_assets/app/actions/controller.tsx')),
    ])
    assert.equal(publicResponse.status, 200)
    assert.equal(privateResponse.status, 404)
  })
})

async function getTestDocsContext() {
  return {
    docFiles: [],
    docFilesLookup: new Map(),
    registry: buildRegistry([]),
  }
}

describe('getApiRouteHref()', () => {
  it('returns undefined for non-API hrefs', () => {
    assert.equal(getApiRouteHref('https://example.com/Accept'), undefined)
  })

  it('preserves docs hrefs with files, queries and hashes', () => {
    assert.equal(
      getApiRouteHref('/headers/accept/class/Accept.md?tab=docs#example'),
      '/headers/accept/class/Accept.md?tab=docs#example',
    )
  })

  it('adds a trailing slash to docs page hrefs', () => {
    assert.equal(getApiRouteHref('/ui/tabs'), '/ui/tabs/')
  })

  it('drops the scope from import-path hrefs', () => {
    assert.equal(getApiRouteHref('/remix/router/type/Route'), '/router/type/Route/')
    assert.equal(getApiRouteHref('/remix-run/ui/tabs/'), '/ui/tabs/')
    assert.equal(getApiRouteHref('/remix/'), '/remix/')
  })

  it('keeps overview segments in current docs hrefs', () => {
    assert.equal(getApiRouteHref('/remix/example/function/overview'), '/example/function/overview/')
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
