import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { parse } from 'node-html-parser'

import { assets } from './assets.ts'
import { editionLinks, productGroups, whyCards, whyLinks } from './data/navigation.ts'
import { pageSummaries } from './data/pages.ts'
import { videos } from './data/videos.ts'
import { router } from './router.ts'
import { routes } from './routes.ts'

const origin = 'http://shopify-demo.local'
const cdn = 'https://cdn.shopify.com/'

describe('Shopify demo', () => {
  it('renders every page in the main navigation as a complete HTML document', async () => {
    let links = [
      ...whyCards,
      ...whyLinks,
      ...productGroups.flatMap((group) => group.links),
      ...editionLinks,
    ]
    let localPaths = new Set(
      links
        .filter((link) => link.href.startsWith('/'))
        .map((link) => new URL(link.href, origin).pathname),
    )
    localPaths.add('/pricing')
    assert.equal(localPaths.size, Object.values(pageSummaries).length)
    let marketingPaths = new Set(Object.values(routes.marketing).map((route) => route.href()))
    for (let pathname of ['/', '/sitemap', ...localPaths]) {
      let response = await router.fetch(new Request(origin + pathname))
      assert.equal(response.status, 200, pathname)
      assert.match(response.headers.get('Content-Type') ?? '', /text\/html/)
      let html = await response.text()
      let document = parse(html)
      assert.match(html, /^<!doctype html>/i)
      assert.equal(document.querySelectorAll('h1').length, 1, pathname)
      assert.equal(document.querySelector('html')?.getAttribute('lang'), 'en')
      assert.equal(
        document.querySelectorAll('script').length,
        pathname === '/' || pathname === '/agentic-storefronts' ? 1 : 0,
      )
      let page = Object.values(pageSummaries).find((page) => page.path === pathname)
      if (page && marketingPaths.has(pathname)) {
        assert.equal(document.querySelector('title')?.textContent, `${page.label} — Shopify demo`)
      }
    }
  })

  it('returns a useful 404 and serves local assets through the same router', async () => {
    let response = await router.fetch(new Request(origin + '/this-page-is-missing'))
    assert.equal(response.status, 404)
    assert.match(await response.text(), /Back to the homepage/)
    let asset = await router.fetch(new Request(origin + assets.styles))
    assert.equal(asset.status, 200)
    assert.match(asset.headers.get('Content-Type') ?? '', /text\/css/)
    assert.match(await asset.text(), /@font-face/)
    let missingAsset = await router.fetch(new Request(origin + '/assets/app/ui/public/missing.css'))
    assert.equal(missingAsset.status, 404)
  })

  it('handles query strings, methods, and missing paths', async () => {
    let page = await router.fetch(new Request(origin + '/website/builder?from=nav'))
    assert.equal(page.status, 200)
    assert.match(await page.text(), /Your idea. Your website. Your way./)

    let head = await router.fetch(new Request(origin + '/website/builder', { method: 'HEAD' }))
    assert.equal(head.status, 200)
    assert.equal(await head.text(), '')

    let post = await router.fetch(new Request(origin + '/pricing', { method: 'POST' }))
    assert.equal(post.status, 405)
    assert.equal(post.headers.get('Allow'), 'GET, HEAD')

    let marketingPost = await router.fetch(
      new Request(origin + '/website/builder', { method: 'POST' }),
    )
    assert.equal(marketingPost.status, 405)
    assert.equal(marketingPost.headers.get('Allow'), 'GET, HEAD')

    let homePost = await router.fetch(new Request(origin, { method: 'POST' }))
    assert.equal(homePost.status, 405)

    let missing = await router.fetch(new Request(origin + '/pricing/extra'))
    assert.equal(missing.status, 404)
    assert.match(await missing.text(), /Back to the homepage/)

    let missingPost = await router.fetch(new Request(origin + '/nope', { method: 'POST' }))
    assert.equal(missingPost.status, 404)

    let missingHead = await router.fetch(
      new Request(origin + '/this-page-is-missing', { method: 'HEAD' }),
    )
    assert.equal(missingHead.status, 404)
    assert.match(missingHead.headers.get('Content-Type') ?? '', /text\/html/)
    assert.equal(await missingHead.text(), '')
  })

  it('links every video to its original file on Shopify’s CDN', async () => {
    let cdnVideos = new Set<string>(Object.values(videos))
    for (let pathname of ['/', '/agentic-storefronts']) {
      let response = await router.fetch(new Request(origin + pathname))
      let document = parse(await response.text())
      let sources = document
        .querySelectorAll('video[src], video source')
        .map((element) => element.getAttribute('src') ?? element.getAttribute('data-src') ?? '')
      assert.ok(sources.length > 0, pathname)
      for (let source of sources) {
        assert.ok(cdnVideos.has(source), `${pathname}: ${source}`)
      }
    }
  })

  it('serves images from Shopify’s CDN with their dimensions reserved', async () => {
    let localImages = new Set([assets.logo, assets.heroPoster, assets.agenticHeroPoster])
    for (let pathname of ['/', '/agentic-storefronts', routes.marketing.checkout.href()]) {
      let response = await router.fetch(new Request(origin + pathname))
      let document = parse(await response.text())
      let images = document.querySelectorAll('img')
      assert.ok(images.length > 0, pathname)
      for (let image of images) {
        let src = image.getAttribute('src') ?? ''
        assert.ok(localImages.has(src) || src.startsWith(cdn), `${pathname}: ${src}`)
        assert.ok(Number(image.getAttribute('width')) > 0, `${pathname}: ${src}`)
        assert.ok(Number(image.getAttribute('height')) > 0, `${pathname}: ${src}`)
        for (let candidate of (image.getAttribute('srcset') ?? '').split(', ').filter(Boolean)) {
          assert.ok(candidate.startsWith(cdn), `${pathname}: ${candidate}`)
        }
      }
      for (let video of document.querySelectorAll('video[poster]')) {
        let poster = video.getAttribute('poster') ?? ''
        assert.ok(localImages.has(poster) || poster.startsWith(cdn), `${pathname}: ${poster}`)
      }
    }
  })

  it('redirects trailing slashes to the canonical URL and keeps query parameters', async () => {
    for (let pathname of ['/pricing', '/website/builder', '/editions/spring2026', '/sitemap']) {
      let response = await router.fetch(new Request(`${origin}${pathname}/?from=nav`))
      assert.equal(response.status, 301, pathname)
      assert.equal(response.headers.get('Location'), `${pathname}?from=nav`)
    }

    let head = await router.fetch(new Request(origin + '/pricing/', { method: 'HEAD' }))
    assert.equal(head.status, 301)
    assert.equal(head.headers.get('Location'), '/pricing')
    assert.equal(await head.text(), '')
  })
})
