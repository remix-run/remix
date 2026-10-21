import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { Locator, Page } from 'playwright'

import { createTestRouter } from '../test/helpers.ts'

const router = await createTestRouter()

describe('bookstore prefetching', () => {
  it('reuses viewport-prefetched frame HTML without caching document navigations', async (t) => {
    let requests: Request[] = []
    let imageRequests: string[] = []
    let page = await t.serve(
      await createTestServer((request) => {
        let { pathname, search } = new URL(request.url)
        if (pathname === '/books/bbq') requests.push(request)
        if (pathname.startsWith('/assets/app/images/') || pathname.startsWith('/images/')) {
          imageRequests.push(pathname + search)
        }
        return router.fetch(request)
      }),
    )
    let prefetched = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/books/bbq',
    )
    let documentResponse = await page.goto('/')
    assert.equal(documentResponse?.headers()['cache-control'], 'no-store')
    await waitForNavigationRuntime(page)
    let stylesheet = await page.locator('head link[rel="stylesheet"]').elementHandle()
    assert.ok(stylesheet)
    let stylesheetRequests: string[] = []
    page.on('request', (request) => {
      let pathname = new URL(request.url()).pathname
      if (pathname.startsWith('/assets/app/actions/public/app.') && pathname.endsWith('.css')) {
        stylesheetRequests.push(pathname)
      }
    })
    let cover = page.getByRole('img', { name: 'Ash & Smoke', exact: true })
    let coverHref = await cover.getAttribute('src')
    assert.ok(coverHref?.match(/^\/assets\/app\/images\/bbq-1\.@[\w-]+\.png$/))
    await page.waitForFunction(() => {
      let image = document.querySelector('img[alt="Ash & Smoke"]')
      return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
    })

    let link = page.locator('a[data-rmx-prefetch="viewport"][href="/books/bbq"]').first()
    await link.scrollIntoViewIfNeeded()
    let response = await prefetched
    assert.equal(response.headers()['cache-control'], 'private, max-age=30')
    await response.finished()
    await page.waitForFunction(() => !document.querySelector('head link[rel="prefetch"]'))
    assert.equal(imageRequests.filter((path) => path.includes('/bbq-')).length, 1)
    await link.click()
    await page.getByRole('heading', { level: 1, name: 'Ash & Smoke', exact: true }).waitFor()
    assert.equal(requests.length, 1)
    assert.equal(requests[0].headers.get('X-Remix-Frame'), 'true')
    assert.equal(
      await page.getByRole('img', { name: 'Image 1 of 3' }).getAttribute('src'),
      coverHref,
    )
    assert.equal(await page.locator('head link[rel="preload"][as="image"]').count(), 1)
    assert.equal(
      await page.locator('head link[rel="preload"][as="image"]').getAttribute('href'),
      coverHref,
    )
    assert.equal(
      await page.getByRole('img', { name: 'Image 2 of 3' }).getAttribute('loading'),
      'lazy',
    )
    assert.equal(
      await page.getByRole('img', { name: 'Image 3 of 3' }).getAttribute('loading'),
      'lazy',
    )
    await page.waitForFunction(() => {
      let image = document.querySelector('img[alt="Image 1 of 3"]')
      return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
    })
    assert.equal(imageRequests.filter((path) => path === coverHref).length, 1)
    assert.equal(
      await stylesheet.evaluate(
        (node) => node === document.querySelector('head link[rel="stylesheet"]'),
      ),
      true,
    )
    assert.equal(stylesheetRequests.length, 0)
    assert.equal(
      imageRequests.some((path) => path.startsWith('/images/')),
      false,
    )

    let freshDocument = await page.goto('/books/bbq')
    assert.equal(freshDocument?.headers()['cache-control'], 'no-store')
    assert.equal(requests.length, 2)
    assert.equal(requests[1].headers.get('X-Remix-Frame'), null)
  })

  it('prefetches header links on intent', async (t) => {
    let requests = 0
    let page = await t.serve(
      await createTestServer((request) => {
        if (new URL(request.url).pathname === '/about') requests++
        return router.fetch(request)
      }),
    )
    await page.goto('/')
    await waitForNavigationRuntime(page)
    assert.equal(requests, 0)

    let prefetched = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/about',
    )
    let link = page.getByRole('banner').getByRole('link', { name: 'About', exact: true })
    await link.hover()
    await (await prefetched).finished()
    await link.click()
    await page.getByRole('heading', { name: 'About Our Bookstore' }).waitFor()
    assert.equal(requests, 1)
  })

  it('observes links added by frame navigation and does not repeat on viewport reentry', async (t) => {
    let requests: string[] = []
    let page = await t.serve(
      await createTestServer((request) => {
        let url = new URL(request.url)
        if (url.pathname.startsWith('/books/')) requests.push(url.pathname + url.search)
        return router.fetch(request)
      }),
    )
    let discoveries: string[] = []
    page.on('request', (request) => {
      let url = new URL(request.url())
      if (url.pathname.startsWith('/books/')) discoveries.push(url.pathname + url.search)
    })
    await page.setViewportSize({ width: 1000, height: 400 })
    await page.goto('/about')
    await waitForNavigationRuntime(page)
    await page.getByRole('banner').getByRole('link', { name: 'Books', exact: true }).click()
    await page.getByRole('heading', { name: 'Browse Books', exact: true }).waitFor()

    let link = page.locator('a[data-rmx-prefetch="viewport"][href="/books/bbq"]').first()
    assert.equal(await isInViewport(link), false)
    assert.equal(requests.includes('/books/bbq'), false)

    let prefetched = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/books/bbq',
    )
    await link.scrollIntoViewIfNeeded()
    await (await prefetched).finished()
    await page.waitForFunction(() => !document.querySelector('head link[rel="prefetch"]'))
    await page.getByRole('banner').scrollIntoViewIfNeeded()
    assert.equal(await isInViewport(link), false)
    await link.scrollIntoViewIfNeeded()
    assert.equal(await isInViewport(link), true)
    assert.equal(requests.filter((path) => path === '/books/bbq').length, 1)
    assert.equal(discoveries.filter((path) => path === '/books/bbq').length, 1)

    let changed = page.waitForResponse(
      (response) => new URL(response.url()).search === '?from=changed-link',
    )
    await link.evaluate((anchor) =>
      anchor.setAttribute('href', '/books/three-ways?from=changed-link'),
    )
    await (await changed).finished()
    assert.equal(
      requests.filter((path) => path === '/books/three-ways?from=changed-link').length,
      1,
    )
  })
})

async function waitForNavigationRuntime(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    let state = window.navigation.currentEntry?.getState()
    return typeof state === 'object' && state != null && '$rmx' in state
  })
}

async function isInViewport(link: Locator): Promise<boolean> {
  return link.evaluate(
    (anchor) =>
      new Promise<boolean>((resolve) => {
        let observer = new IntersectionObserver(([entry]) => {
          observer.disconnect()
          setTimeout(() => resolve(entry.isIntersecting), 0)
        })
        observer.observe(anchor)
      }),
  )
}
