import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { contentFrameHeaders, createTestRouter, getCookiePair, origin } from '../test/helpers.ts'
import { serializeSpeedSettings } from './utils/speed-settings.ts'

const router = await createTestRouter()
const familyUrl = `${origin}/products/screws/socket-head-screws`

async function getSlowModeCookie(): Promise<string> {
  let setCookie = await serializeSpeedSettings({ techniques: false, latency: 0 })
  return setCookie.split(';')[0]
}

describe('documents', () => {
  it('render the shell around a content frame for the requested page', async () => {
    let response = await router.fetch(familyUrl)
    let html = await response.text()

    assert.equal(response.status, 200)
    assert.match(html, /<title>Socket Head Screws \| Remix Supply<\/title>/)
    assert.match(html, /aria-label="Catalog"/)
    assert.match(html, /83,520 of 83,520 parts/)
  })

  it('are private and revalidated with an ETag on every visit', async () => {
    let response = await router.fetch(familyUrl, { headers: { Accept: 'text/html' } })

    assert.equal(response.headers.get('Cache-Control'), 'private, no-cache')
    assert.equal(response.headers.get('Vary'), 'x-remix-target, accept-encoding')
    assert.match(response.headers.get('ETag') ?? '', /^W\/"[0-9a-f]+"$/)
  })

  it('answer a matching If-None-Match with an empty 304', async () => {
    let first = await router.fetch(familyUrl, { headers: { Accept: 'text/html' } })
    let etag = first.headers.get('ETag') ?? ''

    let second = await router.fetch(familyUrl, {
      headers: { Accept: 'text/html', 'If-None-Match': etag },
    })

    assert.equal(second.status, 304)
    assert.equal(second.headers.get('ETag'), etag)
    assert.equal(await second.text(), '')
  })

  it('get a new ETag when the visitor’s cart changes', async () => {
    let before = await router.fetch(familyUrl, { headers: { Accept: 'text/html' } })
    let added = await router.fetch(`${origin}/cart/add`, {
      method: 'POST',
      body: new URLSearchParams({ partNumber: '1000A001', quantity: '1' }),
    })

    let after = await router.fetch(familyUrl, {
      headers: { Accept: 'text/html', Cookie: getCookiePair(added, 'session') },
    })

    assert.notEqual(after.headers.get('ETag'), before.headers.get('ETag'))
  })

  it('are compressed for browsers that accept it', async () => {
    let response = await router.fetch(familyUrl, { headers: { 'Accept-Encoding': 'br' } })

    assert.equal(response.headers.get('Content-Encoding'), 'br')
  })
})

describe('content frames', () => {
  it('render only the page content and its title', async () => {
    let response = await router.fetch(familyUrl, { headers: contentFrameHeaders })
    let html = await response.text()

    assert.match(html, /83,520 of 83,520 parts/)
    assert.match(html, /"title":"Socket Head Screws"/)
    assert.doesNotMatch(html, /<html/)
    assert.doesNotMatch(html, /aria-label="Catalog"/)
  })

  it('are shareable so browsers and CDNs can reuse prefetched HTML', async () => {
    let response = await router.fetch(familyUrl, { headers: contentFrameHeaders })

    assert.equal(
      response.headers.get('Cache-Control'),
      'public, max-age=300, stale-while-revalidate=86400',
    )
    assert.equal(response.headers.get('Vary'), 'x-remix-target, accept-encoding')
    assert.equal(response.headers.getSetCookie().length, 0)
  })

  it('apply spec filters from the URL', async () => {
    let response = await router.fetch(`${familyUrl}?material=316-stainless-steel&length=1%22`, {
      headers: contentFrameHeaders,
    })
    let html = await response.text()

    assert.match(html, /174 of 83,520 parts/)
    assert.match(html, /316 Stainless Steel Socket Head Screws/)
    assert.doesNotMatch(html, /Black-Oxide Alloy Steel Socket Head Screws/)
  })

  it('are never cached when the page is missing', async () => {
    let response = await router.fetch(`${origin}/products/screws/left-handed-screws`, {
      headers: contentFrameHeaders,
    })

    assert.equal(response.status, 404)
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
    assert.match(await response.text(), /We couldn't find that part/)
  })
})

describe('product images', () => {
  it('declare the part photo as a preload so hover prefetching downloads it too', async () => {
    let response = await router.fetch(`${origin}/parts/1000A010`, {
      headers: contentFrameHeaders,
    })
    let html = await response.text()
    let preload = html.match(/<link rel="preload" as="image" href="([^"]+)"/)

    assert.ok(preload, 'Expected an image preload')
    assert.match(preload[1], /socket-head-screws.*transform=resize%3A512/)
    assert.match(html, new RegExp(`<img src="${escapeRegExp(preload[1])}"`))
  })

  it('serve resized WebP thumbnails from the asset server', async () => {
    let response = await router.fetch(`${origin}/products/screws`, { headers: contentFrameHeaders })
    let src = (await response.text()).match(/<img src="([^"]+)"/)?.[1]
    assert.ok(src, 'Expected a product image')

    let image = await router.fetch(new URL(src.replaceAll('&amp;', '&'), origin))

    assert.equal(image.status, 200)
    assert.equal(image.headers.get('Content-Type'), 'image/webp')
  })
})

describe('missing pages', () => {
  it('return a 404 document for unknown categories, families, and parts', async () => {
    let urls = [
      `${origin}/products/not-a-category`,
      `${origin}/products/nuts/socket-head-screws`,
      `${origin}/parts/00000A000`,
    ]

    let statuses = await Promise.all(urls.map(async (url) => (await router.fetch(url)).status))

    assert.deepEqual(statuses, [404, 404, 404])
  })
})

describe('with the speed techniques off', () => {
  it('sends uncompressed, uncacheable responses without ETags', async () => {
    let response = await router.fetch(familyUrl, {
      headers: {
        Accept: 'text/html',
        'Accept-Encoding': 'br',
        Cookie: await getSlowModeCookie(),
      },
    })

    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.equal(response.headers.get('Content-Encoding'), null)
    assert.equal(response.headers.get('ETag'), null)
  })

  it('renders links without prefetch hints', async () => {
    let response = await router.fetch(`${origin}/`, {
      headers: { Cookie: await getSlowModeCookie() },
    })
    let html = await response.text()

    assert.match(html, /data-speed-techniques="off"/)
    assert.doesNotMatch(html, /data-rmx-prefetch/)
  })
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
