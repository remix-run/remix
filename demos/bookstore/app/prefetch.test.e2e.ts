import { fileURLToPath } from 'node:url'
import * as assert from 'remix/assert'
import type * as Component from 'remix/component'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { Locator, Page } from 'playwright'

import { createTestRouter } from '../test/helpers.ts'
import { assets } from './utils/assets.ts'

// Preserve all category labels for viewport geometry without encoding the full catalog.
const router = await createTestRouter({ bookIds: [1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 33, 34, 45] })

describe('bookstore prefetching', () => {
  it('returns to login on Back after logout', async (t) => {
    let accountStatuses: number[] = []
    let page = await t.serve(
      await createTestServer(async (request) => {
        let response = await router.fetch(request)
        if (new URL(request.url).pathname === '/account') {
          accountStatuses.push(response.status)
        }
        return response
      }),
    )
    await page.goto('/login')
    await waitForNavigationRuntime(page)
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill('customer@example.com')
    await page.getByLabel('Password', { exact: true }).fill('password123')
    await page.getByRole('button', { name: 'Login', exact: true }).click()
    await page.getByRole('heading', { name: 'My Account', exact: true }).waitFor()
    await page.evaluate(async () => window.navigation.transition?.finished)

    await page.getByRole('button', { name: 'Logout', exact: true }).click()
    // The redirected page renders before the replacement navigation to `/` aborts the logout
    // transition, so wait for that navigation before awaiting the current transition.
    await page.waitForURL((url) => url.pathname === '/')
    await page.getByRole('heading', { name: 'Welcome to the Bookstore', exact: true }).waitFor()
    await page.evaluate(async () => window.navigation.transition?.finished)
    await page.evaluate(async () => {
      try {
        await window.navigation.back().finished
      } catch (error) {
        // The login redirect replaces the traversal that requested the account page.
        if (!(error instanceof DOMException) || error.name !== 'AbortError') throw error
      }
    })

    await page.getByRole('heading', { name: 'Login', exact: true }).waitFor()
    assert.equal(new URL(page.url()).pathname, '/login')
    assert.equal(accountStatuses.at(-1), 302)
    assert.equal((await page.locator('body').textContent())?.includes('John Doe'), false)
  })

  it('reuses stale frame HTML on Back/Forward and fetches again on ordinary navigation', async (t) => {
    let requests: string[] = []
    let page = await t.serve(
      await createTestServer(async (request) => {
        let response = await router.fetch(request)
        let pathname = new URL(request.url).pathname
        if (
          (pathname === '/about' || pathname === '/contact') &&
          request.headers.get('X-Remix-Frame') === 'true'
        ) {
          requests.push(pathname)
          // Make browsing HTML immediately stale without waiting for its normal 30-second lifetime.
          response.headers.set('Cache-Control', 'private, max-age=0')
        }
        return response
      }),
    )
    await page.goto('/contact')
    await waitForNavigationRuntime(page)

    await page
      .getByRole('banner')
      .getByRole('link', { name: 'About', exact: true })
      .evaluate((anchor: HTMLAnchorElement) => anchor.click())
    await page.getByRole('heading', { name: 'About Our Bookstore' }).waitFor()
    await page.evaluate(async () => window.navigation.transition?.finished)
    await page
      .getByRole('banner')
      .getByRole('link', { name: 'Contact', exact: true })
      .evaluate((anchor: HTMLAnchorElement) => anchor.click())
    await page.getByRole('heading', { name: 'Contact Us', exact: true }).waitFor()
    await page.evaluate(async () => window.navigation.transition?.finished)
    assert.deepEqual(requests, ['/about', '/contact'])

    await page.evaluate(async () => window.navigation.back().finished)
    await page.getByRole('heading', { name: 'About Our Bookstore' }).waitFor()
    await page.evaluate(async () => window.navigation.forward().finished)
    await page.getByRole('heading', { name: 'Contact Us', exact: true }).waitFor()
    assert.deepEqual(
      requests,
      reusesCachedHtml(page)
        ? ['/about', '/contact']
        : ['/about', '/contact', '/about', '/contact'],
    )

    await page
      .getByRole('banner')
      .getByRole('link', { name: 'About', exact: true })
      .evaluate((anchor: HTMLAnchorElement) => anchor.click())
    await page.getByRole('heading', { name: 'About Our Bookstore' }).waitFor()
    await page.evaluate(async () => window.navigation.transition?.finished)
    assert.equal(
      requests.filter((pathname) => pathname === '/about').length,
      reusesCachedHtml(page) ? 2 : 3,
    )
  })

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
    // Keep the image working set small as the seed catalog grows.
    let documentResponse = await page.goto('/books/genre/cookbook')
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
    assert.ok(
      coverHref?.match(/^\/assets\/app\/images\/bbq-1\.@[\w-]+\.png\?transform=book-image-640$/),
    )
    page.on('requestfailed', (request) => {
      let { pathname, search } = new URL(request.url())
      // Firefox can cancel lazy images during hydration; only the cover was prefetched.
      if (
        pathname.startsWith('/assets/') &&
        (request.resourceType() !== 'image' || pathname + search === coverHref)
      ) {
        failedAssets.push(
          `${request.url()} (${request.failure()?.errorText}, ${request.resourceType()})`,
        )
      }
    })
    await page.waitForFunction(() => {
      let image = document.querySelector('img[alt="Ash & Smoke"]')
      return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
    })
    let chosenCoverHref = await cover.evaluate((image: HTMLImageElement) => {
      let url = new URL(image.currentSrc)
      return url.pathname + url.search
    })

    let link = page.locator('a[data-rmx-prefetch="viewport"][href="/books/bbq"]').first()
    await link.scrollIntoViewIfNeeded()
    let response = await prefetched
    assert.equal(response.headers()['cache-control'], 'private, max-age=30')
    await response.finished()
    await page.waitForFunction(
      () => !document.querySelector('head link[rel="prefetch"], [data-responsive-prefetch]'),
    )
    assert.equal(imageRequests.filter((path) => path.includes('/bbq-')).length, 1)
    await link.click()
    await page.getByRole('heading', { level: 1, name: 'Ash & Smoke', exact: true }).waitFor()
    assert.equal(requests.length, reusesCachedHtml(page) ? 1 : 2)
    assert.equal(requests[0].headers.get('X-Remix-Frame'), 'true')
    assert.equal(
      await page.getByRole('img', { name: 'Image 1 of 3' }).getAttribute('src'),
      coverHref,
    )
    // Other visible cards may still have temporary responsive prefetch hints in the head.
    let selectedPreload = page.locator(
      'head link[rel="preload"][as="image"]:not([data-responsive-prefetch])',
    )
    assert.equal(await selectedPreload.count(), 1)
    assert.equal(await selectedPreload.getAttribute('href'), coverHref)
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
    let faceoutHref = await page
      .getByRole('img', { name: 'Image 1 of 3' })
      .evaluate((image: HTMLImageElement) => {
        let url = new URL(image.currentSrc)
        return url.pathname + url.search
      })
    assert.equal(faceoutHref, chosenCoverHref)
    assert.equal(imageRequests.filter((path) => path === faceoutHref).length, 1)
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
    assert.equal(requests.length, reusesCachedHtml(page) ? 2 : 3)
    assert.equal(requests.at(-1)?.headers.get('X-Remix-Frame'), null)
  })

  it('warms destination assets from no-store HTML and fetches HTML again on navigation', async (t) => {
    let scriptHref = await assets.getHref(
      fileURLToPath(new URL('./actions/books/public/image-carousel.tsx', import.meta.url)),
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
    let [prefetched] = await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).pathname === '/books/bbq'),
      (async () => {
        await page.goto('/books/genre/cookbook', { waitUntil: 'domcontentloaded' })
        await waitForNavigationRuntime(page)
        let link = page.locator('a[data-rmx-prefetch="viewport"][href="/books/bbq"]').first()
        await link.scrollIntoViewIfNeeded()
      })(),
    ])
    let link = page.locator('a[data-rmx-prefetch="viewport"][href="/books/bbq"]').first()
    assert.equal(prefetched.headers()['cache-control'], 'no-store')
    if (await prefetchesAssets(page)) {
      await page.locator(`head link[rel="prefetch"][href$="${scriptHref}"]`).waitFor({
        state: 'attached',
      })
      await page.locator(`head link[rel="prefetch"][href$="${styleHref}"]`).waitFor({
        state: 'attached',
      })
      assert.equal(await page.getByRole('button', { name: 'Next image' }).count(), 0)
      assert.equal(
        await page.locator(`head link[rel="stylesheet"][href="${styleHref}"]`).count(),
        0,
      )

      let warmed = Promise.all([page.waitForResponse(scriptHref), page.waitForResponse(styleHref)])
      release.resolve()
      await warmed
      await page.waitForFunction(() => !document.querySelector('head link[rel="prefetch"]'))
    } else {
      release.resolve()
    }
    await link.click()
    await page.getByRole('heading', { name: 'Ash & Smoke', exact: true }).waitFor()
    await page.evaluate(async () => window.navigation.transition?.finished)
    await page.getByRole('button', { name: 'Next image' }).click()
    await page.waitForFunction(() => {
      let track = document.querySelector('img[alt="Image 1 of 3"]')?.parentElement?.parentElement
      if (!track) return false
      let transform = new DOMMatrixReadOnly(getComputedStyle(track).transform)
      return Math.abs(transform.m41 + track.clientWidth) < 1
    })
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

  it(
    'joins a navigation to discovery HTML whose body is still streaming',
    { timeout: 30_000 },
    async (t) => {
      let release = Promise.withResolvers<void>()
      t.after(() => release.resolve())
      let requests = 0
      let page = await t.serve(
        await createTestServer(async (request) => {
          if (new URL(request.url).pathname === '/contact') {
            requests++
            if (requests === 1) {
              let headers = new Headers(request.headers)
              headers.delete('Accept-Encoding')
              let response = await router.fetch(new Request(request, { headers }))
              let html = await response.text()
              response.headers.set('Cache-Control', 'no-store')
              return new Response(
                new ReadableStream({
                  async start(controller) {
                    controller.enqueue(new TextEncoder().encode(html))
                    await release.promise
                    controller.close()
                  },
                }),
                { headers: response.headers },
              )
            }
          }
          return router.fetch(request)
        }),
      )
      await page.goto('/about')
      await waitForNavigationRuntime(page)
      assert.equal(requests, 0)
      let link = page.getByRole('banner').getByRole('link', { name: 'Contact', exact: true })
      let prefetched = page.waitForResponse(
        (response) => new URL(response.url()).pathname === '/contact',
      )
      await link.hover()
      await prefetched
      await link.evaluate((anchor: HTMLAnchorElement) => anchor.click())
      assert.equal(requests, 1)
      release.resolve()
      await page.getByRole('heading', { name: 'Contact Us', exact: true }).waitFor()
      await page.evaluate(async () => window.navigation.transition?.finished)
      assert.equal(requests, 1)
    },
  )

  it('keeps an unfinished shared asset prefetch connected through frame navigation', async (t) => {
    let scriptHref = await assets.getHref(
      fileURLToPath(new URL('./actions/books/public/image-carousel.tsx', import.meta.url)),
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
    let prefetched = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/books/bbq',
    )
    await page.goto('/books/genre/cookbook')
    await waitForNavigationRuntime(page)
    let link = page.locator('a[data-rmx-prefetch="viewport"][href="/books/bbq"]').first()
    let prefetchesScript = await prefetchesAssets(page)
    await link.scrollIntoViewIfNeeded()
    if (prefetchesScript) {
      await started.promise
      let prefetchHref = await assets.getHref(
        fileURLToPath(
          new URL('../../../packages/component/src/runtime/prefetch.ts', import.meta.url),
        ),
      )
      // Retain a caller after navigation removes the declarative trigger's anchor.
      await page.evaluate(async (href) => {
        let { prefetch }: Pick<typeof Component, 'prefetch'> = await import(href)
        prefetch('/books/bbq')
      }, prefetchHref)
    } else {
      await (await prefetched).finished()
    }
    let failedAssets: string[] = []
    page.on('requestfailed', (request) => {
      if (new URL(request.url()).pathname === scriptHref) failedAssets.push(request.url())
    })
    let anchor = await link.elementHandle()
    assert.ok(anchor)
    let hint = prefetchesScript
      ? await page.locator(`head link[rel="prefetch"][href$="${scriptHref}"]`).elementHandle()
      : null
    await link.click()
    await page.getByRole('heading', { level: 1, name: 'Ash & Smoke', exact: true }).waitFor()
    assert.equal(await anchor.evaluate((node) => node.isConnected), false)
    if (prefetchesScript) {
      assert.ok(hint)
      assert.equal(await hint.evaluate((node) => node.isConnected), true)
    }
    assert.equal(
      await page.locator(`head link[rel="prefetch"][href$="${scriptHref}"]`).count(),
      prefetchesScript ? 1 : 0,
    )
    release.resolve()
    await page.evaluate(async () => window.navigation.transition?.finished)
    await page.getByRole('button', { name: 'Next image' }).click()
    await page.waitForFunction(() => {
      let track = document.querySelector('img[alt="Image 1 of 3"]')?.parentElement?.parentElement
      if (!track) return false
      let transform = new DOMMatrixReadOnly(getComputedStyle(track).transform)
      return Math.abs(transform.m41 + track.clientWidth) < 1
    })
    assert.equal(requests, 1)
    assert.deepEqual(failedAssets, [])
  })

  it('prefetches mobile faceout and related covers on card hover and reuses them on navigation', async (t) => {
    let requests: Request[] = []
    let images: string[] = []
    let page = await t.serve(
      await createTestServer((request) => {
        let url = new URL(request.url)
        if (url.pathname.startsWith('/books/')) requests.push(request)
        if (url.pathname.startsWith('/assets/app/images/')) images.push(url.pathname + url.search)
        return router.fetch(request)
      }),
    )
    let errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width: 412, height: 823 })
    let mainPage = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/books/bbq',
    )
    await page.goto('/search?q=Ash%20%26%20Smoke')
    await waitForNavigationRuntime(page)
    await (await mainPage).finished()
    await page.waitForFunction(
      () => !document.querySelector('head link[rel="prefetch"], [data-responsive-prefetch]'),
    )
    assert.deepEqual(
      requests.map((request) => new URL(request.url).pathname),
      ['/books/bbq'],
    )
    let supportsAssetPrefetch = await prefetchesAssets(page)
    if (supportsAssetPrefetch) {
      assert.deepEqual(
        images
          .filter((href) => href.includes('/bbq-1.'))
          .map((href) => new URL(href, page.url()).search)
          .sort(),
        ['?transform=book-image-320', '?transform=book-image-480'],
      )
    }
    assert.equal(
      images.some((href) => /\/bbq-[23]\./.test(href)),
      false,
    )

    let related = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/books/bbq/related',
    )
    let coverResponses = supportsAssetPrefetch
      ? ['bread-before-dawn', 'sunday-noodle-shop', 'citrus-and-salt'].map((slug) =>
          page.waitForResponse((response) =>
            new URL(response.url()).pathname.includes(`/${slug}-1.`),
          ),
        )
      : []
    let card = page.locator('[data-test-slug="bbq"]')
    await card.getByText('by Rusty Char-Broil', { exact: true }).hover()
    await (await related).finished()
    await Promise.all(coverResponses.map(async (response) => (await response).finished()))
    await page.waitForFunction(
      () => !document.querySelector('head link[rel="prefetch"], [data-responsive-prefetch]'),
    )
    assert.equal(requests[1].headers.get('X-Remix-Prefetch'), 'true')
    assert.equal(requests[1].headers.get('X-Remix-Target'), 'related-books-1')
    assert.equal(await page.locator('[data-test-slug]').count(), 1)
    assert.deepEqual(
      requests.map((request) => new URL(request.url).pathname),
      ['/books/bbq', '/books/bbq/related'],
    )
    if (supportsAssetPrefetch) {
      assert.equal(images.filter((href) => !href.includes('/bbq-')).length, 3)
      assert.ok(
        images.every((href) => /\?transform=book-image-(?:320|480|640|768|960)$/.test(href)),
      )
    }

    await card.getByRole('heading', { name: 'Ash & Smoke', exact: true }).hover()
    await page.mouse.move(0, 0)
    let details = card.getByRole('link', { name: 'View Details', exact: true })
    await details.focus()
    await card.hover()
    await details.click()
    await page.getByRole('heading', { level: 1, name: 'Ash & Smoke', exact: true }).waitFor()
    let section = page.getByRole('region', { name: 'Related Books', exact: true })
    await section.scrollIntoViewIfNeeded()
    await section.getByRole('heading', { name: 'Citrus & Salt', exact: true }).waitFor()
    let covers = section.locator('img')
    for (let cover of await covers.all()) {
      await cover.scrollIntoViewIfNeeded()
      let image = await cover.elementHandle()
      assert.ok(image)
      try {
        await page.waitForFunction(
          (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
          image,
        )
        await cover.evaluate((image: HTMLImageElement) => image.decode())
      } finally {
        await image.dispose()
      }
    }
    let chosen = await covers.evaluateAll((images) =>
      images.map((image) => {
        if (!(image instanceof HTMLImageElement)) throw new Error('Expected a cover image')
        let url = new URL(image.currentSrc)
        return url.pathname + url.search
      }),
    )
    assert.ok(chosen.every((href) => href.endsWith('?transform=book-image-480')))
    assert.equal(
      requests.filter((request) => new URL(request.url).pathname === '/books/bbq/related').length,
      reusesCachedHtml(page) ? 1 : 2,
    )
    if (supportsAssetPrefetch) {
      for (let href of chosen) assert.equal(images.filter((request) => request === href).length, 1)
    }
    assert.deepEqual(errors, [])
  })

  it(
    'joins a pending related-books prefetch when the details page loads its lazy frame',
    { timeout: 30_000 },
    async (t) => {
      let requested = Promise.withResolvers<void>()
      let release = Promise.withResolvers<void>()
      t.after(() => release.resolve())
      let relatedRequests: Request[] = []
      let page = await t.serve(
        await createTestServer(async (request) => {
          if (new URL(request.url).pathname === '/books/bbq/related') {
            relatedRequests.push(request)
            let headers = new Headers(request.headers)
            headers.delete('Accept-Encoding')
            let response = await router.fetch(new Request(request, { headers }))
            let html = await response.text()
            response.headers.delete('Content-Length')
            // Keep the prefix available until the lazy frame has joined the pending response.
            return new Response(
              new ReadableStream<Uint8Array>({
                async start(controller) {
                  controller.enqueue(new TextEncoder().encode(html))
                  requested.resolve()
                  await release.promise
                  controller.close()
                },
              }),
              { status: response.status, headers: response.headers },
            )
          }
          return router.fetch(request)
        }),
      )
      let errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.setViewportSize({ width: 1280, height: 250 })
      let detailsPrefetched = page.waitForResponse(
        (response) => new URL(response.url()).pathname === '/books/bbq',
      )
      await page.goto('/search?q=Ash%20%26%20Smoke')
      await waitForNavigationRuntime(page)
      await page.getByRole('link', { name: 'Ash & Smoke', exact: true }).scrollIntoViewIfNeeded()
      await (await detailsPrefetched).finished()
      let card = page.locator('[data-test-slug="bbq"]')
      await card.getByRole('link', { name: 'View Details', exact: true }).focus()
      await requested.promise
      await card
        .getByRole('link', { name: 'View Details', exact: true })
        .evaluate((anchor: HTMLAnchorElement) => anchor.click())
      await page.getByRole('heading', { level: 1, name: 'Ash & Smoke', exact: true }).waitFor()
      await page.evaluate(async () => window.navigation.transition?.finished)
      let related = page.getByRole('region', { name: 'Related Books', exact: true })
      await related.scrollIntoViewIfNeeded()
      await related.getByRole('heading', { name: 'Citrus & Salt', exact: true }).waitFor()
      release.resolve()
      assert.equal(relatedRequests.length, 1)
      assert.equal(relatedRequests[0].headers.get('X-Remix-Prefetch'), 'true')
      assert.equal(relatedRequests[0].headers.get('X-Remix-Target'), 'related-books-1')
      assert.deepEqual(errors, [])
    },
  )

  it('respects Save-Data on card hover and prefetches on keyboard focus when enabled', async (t) => {
    let requests = 0
    let page = await t.serve(
      await createTestServer((request) => {
        if (new URL(request.url).pathname === '/books/bbq/related') requests++
        return router.fetch(request)
      }),
    )
    await page.goto('/search?q=Ash%20%26%20Smoke')
    await waitForNavigationRuntime(page)
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'connection', {
        configurable: true,
        value: { saveData: true },
      })
    })
    let card = page.locator('[data-test-slug="bbq"]')
    await card.getByText('by Rusty Char-Broil', { exact: true }).hover()
    assert.equal(requests, 0)
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'connection', {
        configurable: true,
        value: { saveData: false },
      })
    })
    let related = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/books/bbq/related',
    )
    await card.getByRole('link', { name: 'View Details', exact: true }).focus()
    await (await related).finished()
    assert.equal(requests, 1)
  })

  it('queues card intent arriving before viewport HTML finishes without another page request', async (t) => {
    let requested = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let requests: Request[] = []
    let page = await t.serve(
      await createTestServer(async (request) => {
        let pathname = new URL(request.url).pathname
        if (pathname === '/books/bbq') {
          requests.push(request)
          requested.resolve()
          await release.promise
        }
        if (pathname === '/books/bbq/related') requests.push(request)
        return router.fetch(request)
      }),
    )
    await page.goto('/search?q=Ash%20%26%20Smoke')
    await waitForNavigationRuntime(page)
    await requested.promise
    let card = page.locator('[data-test-slug="bbq"]')
    await card.getByText('by Rusty Char-Broil', { exact: true }).hover()
    await card.getByRole('link', { name: 'View Details', exact: true }).focus()
    assert.equal(requests.length, 1)
    let related = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/books/bbq/related',
    )
    release.resolve()
    await (await related).finished()
    assert.deepEqual(
      requests.map((request) => new URL(request.url).pathname),
      ['/books/bbq', '/books/bbq/related'],
    )
    assert.equal(requests[1].headers.get('X-Remix-Target'), 'related-books-1')
  })

  it('cancels pending card discovery when its link is removed without starting queued frames', async (t) => {
    let requested = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let relatedRequests = 0
    let page = await t.serve(
      await createTestServer(async (request) => {
        let pathname = new URL(request.url).pathname
        if (pathname === '/books/bbq') {
          requested.resolve()
          await release.promise
        }
        if (pathname === '/books/bbq/related') relatedRequests++
        return router.fetch(request)
      }),
    )
    await page.goto('/search?q=Ash%20%26%20Smoke')
    await waitForNavigationRuntime(page)
    await requested.promise
    let card = page.locator('[data-test-slug="bbq"]')
    await card.getByText('by Rusty Char-Broil', { exact: true }).hover()
    let canceled = page.waitForEvent('requestfailed', {
      predicate: (request) => new URL(request.url()).pathname === '/books/bbq',
    })
    await card.evaluate((card) => card.remove())
    await canceled
    release.resolve()
    await page.goto('/about')
    await waitForNavigationRuntime(page)
    assert.equal(relatedRequests, 0)
  })

  it('prefetches visible book covers before their details buttons and does not repeat on viewport reentry', async (t) => {
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

    let link = page.getByRole('link', { name: 'Ash & Smoke', exact: true })
    assert.equal(await isInViewport(link), false)
    assert.equal(requests.includes('/books/bbq'), false)

    let prefetched = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/books/bbq',
    )
    await link.evaluate((anchor) => anchor.scrollIntoView({ block: 'start' }))
    assert.equal(await isInViewport(page.locator('a.btn[href="/books/bbq"]')), false)
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
    let related = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/books/three-ways/related',
    )
    await link.hover()
    let relatedResponse = await related
    await relatedResponse.finished()
    assert.equal(relatedResponse.request().headers()['x-remix-target'], 'related-books-3')
    assert.equal(requests.includes('/books/bbq/related'), false)
  })
})

async function waitForNavigationRuntime(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    let state = window.navigation.currentEntry?.getState()
    return typeof state === 'object' && state != null && '$rmx' in state
  })
}

// Playwright's WebKit contexts keep no HTTP cache, so navigations there fetch prefetched HTML again.
// Safari reuses it, as WebKit does with a persistent profile.
function reusesCachedHtml(page: Page): boolean {
  return page.context().browser()?.browserType().name() !== 'webkit'
}

// Safari can't prefetch links, so the runtime prefetches only a destination's HTML there.
async function prefetchesAssets(page: Page): Promise<boolean> {
  return page.evaluate(() => document.createElement('link').relList.supports('prefetch'))
}

async function isInViewport(link: Locator): Promise<boolean> {
  return link.evaluate(
    (anchor) =>
      new Promise<boolean>((resolve) => {
        let observer = new IntersectionObserver(([entry]) => {
          observer.disconnect()
          resolve(entry.isIntersecting)
        })
        observer.observe(anchor)
      }),
  )
}
