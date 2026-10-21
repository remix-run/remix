import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { Locator, Page } from 'playwright'

import { createTestRouter } from '../test/helpers.ts'
import { assets } from './utils/assets.ts'

const router = await createTestRouter()

describe('bookstore prefetching', () => {
  it('reuses viewport-prefetched frame HTML without caching document navigations', async (t) => {
    let releaseImages = Promise.withResolvers<void>()
    t.after(() => releaseImages.resolve())
    let requests: Request[] = []
    let imageRequests: string[] = []
    let page = await t.serve(
      await createTestServer(async (request) => {
        let { pathname, search } = new URL(request.url)
        if (pathname === '/books/bbq') requests.push(request)
        if (pathname.startsWith('/assets/app/images/') || pathname.startsWith('/images/')) {
          imageRequests.push(pathname + search)
        }
        // Keep lazy images pending while navigation adopts and hydrates the carousel.
        if (pathname.includes('/bbq-2.') || pathname.includes('/bbq-3.')) {
          await releaseImages.promise
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
    let entryRequests: string[] = []
    let failedAssets: string[] = []
    page.on('request', (request) => {
      let pathname = new URL(request.url()).pathname
      if (pathname.startsWith('/assets/app/actions/public/app.') && pathname.endsWith('.css')) {
        stylesheetRequests.push(pathname)
      }
      if (pathname.startsWith('/assets/app/actions/public/entry.')) entryRequests.push(pathname)
    })
    let cover = page.getByRole('img', { name: 'Ash & Smoke', exact: true })
    let coverHref = await cover.getAttribute('src')
    assert.ok(coverHref?.match(/^\/assets\/app\/images\/bbq-1\.@[\w-]+\.png$/))
    page.on('requestfailed', (request) => {
      let pathname = new URL(request.url()).pathname
      // Firefox can cancel lazy images during hydration; only the cover was prefetched.
      if (
        pathname.startsWith('/assets/') &&
        (request.resourceType() !== 'image' || pathname === coverHref)
      ) {
        failedAssets.push(request.url())
      }
    })
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
    assert.deepEqual(entryRequests, [])
    assert.deepEqual(failedAssets, [], `Unexpected asset failures: ${failedAssets.join(', ')}`)
    assert.equal(
      imageRequests.some((path) => path.startsWith('/images/')),
      false,
    )

    releaseImages.resolve()
    let freshDocument = await page.goto('/books/bbq')
    assert.equal(freshDocument?.headers()['cache-control'], 'no-store')
    assert.equal(requests.length, 2)
    assert.equal(requests[1].headers.get('X-Remix-Frame'), null)
  })

  it('warms destination assets from no-store HTML and fetches HTML again on navigation', async (t) => {
    let scriptHref = await assets.getHref(
      new URL('./actions/books/public/image-carousel.tsx', import.meta.url).pathname,
    )
    let styleHref = '/prefetch-only.css'
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let requests: Request[] = []
    let requested: string[] = []
    let page = await t.serve(
      await createTestServer(async (request) => {
        let pathname = new URL(request.url).pathname
        requested.push(pathname)
        if (pathname === scriptHref || pathname === styleHref) await release.promise
        if (pathname === styleHref) {
          return new Response('h1 { border-left: 5px solid rgb(15, 118, 110) }', {
            headers: { 'Content-Type': 'text/css', 'Cache-Control': 'public, max-age=3600' },
          })
        }
        if (pathname === '/books/bbq') {
          requests.push(request)
          let headers = new Headers(request.headers)
          headers.delete('Accept-Encoding')
          let response = await router.fetch(new Request(request, { headers }))
          let html = (await response.text()).replace(
            '</head>',
            `<link rel="stylesheet" href="${styleHref}"></head>`,
          )
          response.headers.set('Cache-Control', 'no-store')
          return new Response(html, { headers: response.headers })
        }
        return router.fetch(request)
      }),
    )
    let prefetched = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/books/bbq',
    )
    await page.goto('/')
    await waitForNavigationRuntime(page)
    let link = page.locator('a[data-rmx-prefetch="viewport"][href="/books/bbq"]').first()
    await link.scrollIntoViewIfNeeded()
    assert.equal((await prefetched).headers()['cache-control'], 'no-store')
    await page.locator(`head link[rel="prefetch"][href$="${scriptHref}"]`).waitFor({
      state: 'attached',
    })
    await page.locator(`head link[rel="prefetch"][href$="${styleHref}"]`).waitFor({
      state: 'attached',
    })
    assert.equal(await page.getByRole('button', { name: 'Next image' }).count(), 0)
    assert.equal(await page.locator(`head link[rel="stylesheet"][href="${styleHref}"]`).count(), 0)

    let warmed = Promise.all([page.waitForResponse(scriptHref), page.waitForResponse(styleHref)])
    release.resolve()
    await warmed
    await page.waitForFunction(() => !document.querySelector('head link[rel="prefetch"]'))
    await link.click()
    await page.getByRole('heading', { name: 'Ash & Smoke', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Next image' }).click()
    await page.waitForFunction(() =>
      document
        .querySelector('img[alt="Image 1 of 3"]')
        ?.parentElement?.parentElement?.style.transform.includes('-100%'),
    )
    assert.equal(
      await page
        .getByRole('heading', { name: 'Ash & Smoke', exact: true })
        .evaluate((heading) => getComputedStyle(heading).borderLeftColor),
      'rgb(15, 118, 110)',
    )
    assert.deepEqual(
      requests.map((request) => ({
        method: request.method,
        frame: request.headers.get('X-Remix-Frame'),
      })),
      [
        { method: 'GET', frame: 'true' },
        { method: 'GET', frame: 'true' },
      ],
    )
    assert.equal(requested.filter((pathname) => pathname === scriptHref).length, 1)
    assert.equal(requested.filter((pathname) => pathname === styleHref).length, 1)
  })

  it('starts a navigation fetch while discovery HTML is still streaming', async (t) => {
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let requests = 0
    let page = await t.serve(
      await createTestServer((request) => {
        if (new URL(request.url).pathname === '/contact') {
          requests++
          if (requests === 1) {
            return new Response(
              new ReadableStream({
                async start(controller) {
                  controller.enqueue(new TextEncoder().encode('<main>'))
                  await release.promise
                  controller.enqueue(new TextEncoder().encode('Discovery response</main>'))
                  controller.close()
                },
              }),
              { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' } },
            )
          }
        }
        return router.fetch(request)
      }),
    )
    await page.goto('/about')
    await waitForNavigationRuntime(page)
    let link = page.getByRole('banner').getByRole('link', { name: 'Contact', exact: true })
    let prefetched = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/contact',
    )
    await link.hover()
    let response = await prefetched
    let navigation = page.waitForRequest(
      (request) =>
        new URL(request.url()).pathname === '/contact' &&
        request.headers()['x-remix-frame'] === 'true',
    )
    await link.click()
    await navigation
    // Browsers may serialize overlapping fetches, so finish discovery after navigation starts.
    release.resolve()
    await response.finished()
    await page.getByRole('heading', { name: 'Contact Us', exact: true }).waitFor()
    assert.equal(requests, 2)
  })

  it('keeps an unfinished asset prefetch connected through frame navigation', async (t) => {
    let scriptHref = await assets.getHref(
      new URL('./actions/books/public/image-carousel.tsx', import.meta.url).pathname,
    )
    let started = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let requests = 0
    let page = await t.serve(
      await createTestServer(async (request) => {
        if (new URL(request.url).pathname === scriptHref) {
          requests++
          started.resolve()
          await release.promise
        }
        return router.fetch(request)
      }),
    )
    await page.goto('/')
    await waitForNavigationRuntime(page)
    let link = page.locator('a[data-rmx-prefetch="viewport"][href="/books/bbq"]').first()
    await link.scrollIntoViewIfNeeded()
    await started.promise
    let failedAssets: string[] = []
    page.on('requestfailed', (request) => {
      if (new URL(request.url()).pathname === scriptHref) failedAssets.push(request.url())
    })
    await link.click()
    await page.getByRole('heading', { name: 'Ash & Smoke', exact: true }).waitFor()
    assert.equal(await page.locator(`head link[rel="prefetch"][href$="${scriptHref}"]`).count(), 1)
    release.resolve()
    await page.getByRole('button', { name: 'Next image' }).click()
    await page.waitForFunction(() =>
      document
        .querySelector('img[alt="Image 1 of 3"]')
        ?.parentElement?.parentElement?.style.transform.includes('-100%'),
    )
    assert.equal(requests, 1)
    assert.deepEqual(failedAssets, [])
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
