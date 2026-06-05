import * as assert from 'remix/assert'
import { after, describe, it } from 'remix/test'

import { assetServer } from './asset-server.ts'
import { getVersionedLookupHref } from './lookup.ts'
import { createRouter } from './router.tsx'
import { getDocsRouteHref } from './routes.ts'

after(async () => {
  await assetServer.close()
})

describe('createRouter()', () => {
  it('does not load generated docs output while creating the router', () => {
    let router = createRouter(['v1.2.3'])
    assert.equal(typeof router.fetch, 'function')
  })

  it('uses a versioned entry URL for versioned docs', async () => {
    let router = createRouter(['v1.2.3'])

    let rootResponse = await router.fetch(new Request('http://localhost/'))
    assert.equal(rootResponse.status, 200)
    let rootHtml = await rootResponse.text()
    assert.equal(rootHtml.includes('src="/assets/client/entry.tsx"'), true)
    assert.equal(rootHtml.includes('href="/assets/client/entry.tsx"'), true)
    assert.equal(rootHtml.includes('src="/v1.2.3/assets/client/entry.tsx"'), false)
    assert.equal(rootHtml.includes('href="/v1.2.3/assets/client/entry.tsx"'), false)

    let versionedResponse = await router.fetch(new Request('http://localhost/v1.2.3/'))
    assert.equal(versionedResponse.status, 200)
    let versionedHtml = await versionedResponse.text()
    assert.equal(versionedHtml.includes('src="/v1.2.3/assets/client/entry.tsx"'), true)
    assert.equal(versionedHtml.includes('href="/v1.2.3/assets/client/entry.tsx"'), true)
    assert.equal(versionedHtml.includes('src="/assets/client/entry.tsx"'), false)
    assert.equal(versionedHtml.includes('href="/assets/client/entry.tsx"'), false)
  })

  it('uses versioned URLs for loaded assets in versioned docs', async () => {
    let router = createRouter(['v1.2.3'])

    let versionedResponse = await router.fetch(new Request('http://localhost/v1.2.3/'))
    assert.equal(versionedResponse.status, 200)
    let versionedHtml = await versionedResponse.text()
    let assetUrls = getLoadedAssetUrls(versionedHtml).filter((url) => shouldVersionAssetUrl(url))

    assert.equal(assetUrls.length > 0, true)
    assert.deepEqual(
      assetUrls.filter((url) => !url.startsWith('/v1.2.3/')),
      [],
    )
  })

  it('uses versioned URLs for loaded assets in versioned demo docs', async () => {
    let router = createRouter(['v1.2.3'])

    let versionedResponse = await router.fetch(
      new Request('http://localhost/v1.2.3/api/remix/ui/accordion/demos/overview/'),
    )
    assert.equal(versionedResponse.status, 200)
    let versionedHtml = await versionedResponse.text()
    let assetUrls = getLoadedAssetUrls(versionedHtml).filter((url) => shouldVersionAssetUrl(url))

    assert.equal(
      assetUrls.some((url) => url.includes('/assets/demos/')),
      true,
    )
    assert.deepEqual(
      assetUrls.filter((url) => !url.startsWith('/v1.2.3/')),
      [],
    )
  })

  it('serves assets through root and versioned paths from one asset server', async () => {
    let router = createRouter(['v1.2.3'])

    let rootAssetResponse = await router.fetch(
      new Request('http://localhost/assets/client/entry.tsx'),
    )
    assert.equal(rootAssetResponse.status, 200)

    let versionedAssetResponse = await router.fetch(
      new Request('http://localhost/v1.2.3/assets/client/entry.tsx'),
    )
    assert.equal(versionedAssetResponse.status, 200)

    let rootAssetBody = await rootAssetResponse.text()
    let versionedAssetBody = await versionedAssetResponse.text()
    assert.equal(rootAssetBody.includes('from "/assets/pkg/remix/src/ui.ts"'), true)
    assert.equal(rootAssetBody.includes('from "/v1.2.3/assets/pkg/remix/src/ui.ts"'), false)
    assert.equal(versionedAssetBody.includes('from "/v1.2.3/assets/pkg/remix/src/ui.ts"'), true)
    assert.equal(versionedAssetBody.includes('from "/assets/pkg/remix/src/ui.ts"'), false)
  })

  it('does not reuse root asset etags for versioned asset responses', async () => {
    let router = createRouter(['v1.2.3'])

    let rootAssetResponse = await router.fetch(
      new Request('http://localhost/assets/client/entry.tsx'),
    )
    assert.equal(rootAssetResponse.status, 200)
    let rootEtag = rootAssetResponse.headers.get('ETag')
    if (rootEtag === null) {
      throw new Error('Expected root asset response to include an ETag')
    }

    let versionedAssetResponse = await router.fetch(
      new Request('http://localhost/v1.2.3/assets/client/entry.tsx', {
        headers: {
          'If-None-Match': rootEtag,
        },
      }),
    )
    assert.equal(versionedAssetResponse.status, 200)
    let versionedAssetBody = await versionedAssetResponse.text()
    assert.equal(versionedAssetBody.includes('from "/v1.2.3/assets/pkg/remix/src/ui.ts"'), true)
    assert.equal(versionedAssetBody.includes('from "/assets/pkg/remix/src/ui.ts"'), false)
  })

  it('reuses versioned asset etags for matching versioned asset responses', async () => {
    let router = createRouter(['v1.2.3'])

    let versionedAssetResponse = await router.fetch(
      new Request('http://localhost/v1.2.3/assets/client/entry.tsx'),
    )
    assert.equal(versionedAssetResponse.status, 200)
    let versionedEtag = versionedAssetResponse.headers.get('ETag')
    if (versionedEtag === null) {
      throw new Error('Expected versioned asset response to include an ETag')
    }

    let notModifiedResponse = await router.fetch(
      new Request('http://localhost/v1.2.3/assets/client/entry.tsx', {
        headers: {
          'If-None-Match': versionedEtag,
        },
      }),
    )
    assert.equal(notModifiedResponse.status, 304)
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
  if (url === '/favicon.ico' || url === '/favicon.svg') return false
  if (url === '/remix-wordmark-light-mode.svg' || url === '/remix-wordmark-dark-mode.svg') {
    return false
  }
  return true
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
