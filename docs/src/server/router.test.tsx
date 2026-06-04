import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { closeAssetServers } from './asset-server.ts'
import { getVersionedLookupHref } from './lookup.ts'
import { createRouter } from './router.tsx'
import { getDocsRouteHref } from './routes.ts'

after(async () => {
  await closeAssetServers()
})

describe('createRouter()', () => {
  it('does not load generated docs output while creating the router', () => {
    let router = createRouter(['v1.2.3'])
    assert.equal(typeof router.fetch, 'function')
  })

  it('uses root asset URLs for root docs and versioned asset URLs for versioned docs', async () => {
    let router = createRouter(['v1.2.3'])

    let rootResponse = await router.fetch(new Request('http://localhost/'))
    assert.equal(rootResponse.status, 200)
    let rootHtml = await rootResponse.text()
    assert.equal(rootHtml.includes('src="/assets/client/entry.tsx"'), true)
    assert.equal(rootHtml.includes('href="/assets/client/entry.tsx"'), true)
    assert.equal(rootHtml.includes('/v1.2.3/assets/client/entry.tsx'), false)

    let versionedResponse = await router.fetch(new Request('http://localhost/v1.2.3/'))
    assert.equal(versionedResponse.status, 200)
    let versionedHtml = await versionedResponse.text()
    assert.equal(versionedHtml.includes('src="/v1.2.3/assets/client/entry.tsx"'), true)
    assert.equal(versionedHtml.includes('href="/v1.2.3/assets/client/entry.tsx"'), true)

    let assetResponse = await router.fetch(
      new Request('http://localhost/v1.2.3/assets/client/entry.tsx'),
    )
    assert.equal(assetResponse.status, 200)
    let assetBody = await assetResponse.text()
    assert.equal(assetBody.includes('from "/v1.2.3/assets/pkg/remix/src/ui.ts"'), true)
    assert.equal(assetBody.includes('from "/assets/pkg/remix/src/ui.ts"'), false)
  })
})

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

describe('getDocsRouteHref()', () => {
  it('returns undefined for non-API hrefs', () => {
    assert.equal(getDocsRouteHref('https://example.com/Accept', 'v1.2.3'), undefined)
  })

  it('preserves unversioned docs hrefs when version is undefined', () => {
    assert.equal(
      getDocsRouteHref('/api/remix/headers/accept/class/Accept.md?tab=docs#example', undefined),
      '/api/remix/headers/accept/class/Accept.md?tab=docs#example',
    )
  })
})
