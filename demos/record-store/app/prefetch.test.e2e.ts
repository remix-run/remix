import { fileURLToPath } from 'node:url'
import * as assert from 'remix/assert'
import type * as Component from 'remix/component'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { Locator, Page } from 'playwright'

import { createTestRouter } from '../test/helpers.ts'
import { assets } from './utils/assets.ts'

// Preserve all category labels for viewport geometry without encoding the full catalog.
const router = await createTestRouter({ albumIds: [1, 2, 3, 4, 5, 6, 7, 10] })

describe('record store prefetching', () => {
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
    await page.getByRole('heading', { name: 'Welcome to the Record Store', exact: true }).waitFor()
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
    await page.getByRole('heading', { name: 'About Our Record Store' }).waitFor()
    await page.evaluate(async () => window.navigation.transition?.finished)
    await page
      .getByRole('banner')
      .getByRole('link', { name: 'Contact', exact: true })
      .evaluate((anchor: HTMLAnchorElement) => anchor.click())
    await page.getByRole('heading', { name: 'Contact Us', exact: true }).waitFor()
    await page.evaluate(async () => window.navigation.transition?.finished)
    assert.deepEqual(requests, ['/about', '/contact'])

    await page.evaluate(async () => window.navigation.back().finished)
    await page.getByRole('heading', { name: 'About Our Record Store' }).waitFor()
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
    await page.getByRole('heading', { name: 'About Our Record Store' }).waitFor()
    await page.evaluate(async () => window.navigation.transition?.finished)
    assert.equal(
      requests.filter((pathname) => pathname === '/about').length,
      reusesCachedHtml(page) ? 2 : 3,
    )
  })

  it('reuses viewport-prefetched frame HTML without caching document navigations', async (t) => {
    let requests: Request[] = []
    let imageRequests: string[] = []
    let page = await t.serve(
      await createTestServer((request) => {
        let { pathname, search } = new URL(request.url)
        if (pathname === '/albums/overpass-stereo') requests.push(request)
        if (pathname.startsWith('/assets/app/images/')) imageRequests.push(pathname + search)
        return router.fetch(request)
      }),
    )
    let prefetched = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/albums/overpass-stereo',
    )
    // Keep the image working set small as the seed catalog grows.
    let documentResponse = await page.goto('/albums/genre/rock')
    assert.equal(documentResponse?.headers()['cache-control'], 'no-store')
    await waitForNavigationRuntime(page)
    let stylesheet = await page.locator('head link[rel="stylesheet"]').elementHandle()
    assert.ok(stylesheet)
    let stylesheetRequests: string[] = []
    let entryRequests: string[] = []
    page.on('request', (request) => {
      let pathname = new URL(request.url()).pathname
      if (pathname.startsWith('/assets/app/actions/public/app.') && pathname.endsWith('.css')) {
        stylesheetRequests.push(pathname)
      }
      if (pathname.startsWith('/assets/app/actions/public/entry.')) entryRequests.push(pathname)
    })
    let cover = page.getByRole('img', { name: 'Overpass Stereo', exact: true })
    await page.waitForFunction(() => {
      let image = document.querySelector('img[alt="Overpass Stereo"]')
      return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
    })
    let chosenCoverHref = await cover.evaluate((image: HTMLImageElement) => {
      let url = new URL(image.currentSrc)
      return url.pathname + url.search
    })

    let link = page
      .locator('a[data-rmx-prefetch="viewport"][href="/albums/overpass-stereo"]')
      .first()
    await link.scrollIntoViewIfNeeded()
    let response = await prefetched
    assert.equal(response.headers()['cache-control'], 'private, max-age=30')
    await response.finished()
    await page.waitForFunction(
      () => !document.querySelector('head link[rel="prefetch"], [data-responsive-prefetch]'),
    )
    assert.equal(imageRequests.filter((path) => path.includes('/overpass-stereo-')).length, 1)
    await link.click()
    await page.getByRole('heading', { level: 1, name: 'Overpass Stereo', exact: true }).waitFor()
    assert.equal(requests.length, reusesCachedHtml(page) ? 1 : 2)
    assert.equal(requests[0].headers.get('X-Remix-Frame'), 'true')
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

    let freshDocument = await page.goto('/albums/overpass-stereo')
    assert.equal(freshDocument?.headers()['cache-control'], 'no-store')
    assert.equal(requests.length, reusesCachedHtml(page) ? 2 : 3)
    assert.equal(requests.at(-1)?.headers.get('X-Remix-Frame'), null)
  })

  it('warms destination assets from no-store HTML and fetches HTML again on navigation', async (t) => {
    let scriptHref = await assets.getHref(
      fileURLToPath(new URL('./actions/albums/public/image-carousel.tsx', import.meta.url)),
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
        if (pathname === '/albums/overpass-stereo') {
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
      page.waitForResponse(
        (response) => new URL(response.url()).pathname === '/albums/overpass-stereo',
      ),
      (async () => {
        await page.goto('/albums/genre/rock', { waitUntil: 'domcontentloaded' })
        await waitForNavigationRuntime(page)
        let link = page
          .locator('a[data-rmx-prefetch="viewport"][href="/albums/overpass-stereo"]')
          .first()
        await link.scrollIntoViewIfNeeded()
      })(),
    ])
    let link = page
      .locator('a[data-rmx-prefetch="viewport"][href="/albums/overpass-stereo"]')
      .first()
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
    await page.getByRole('heading', { name: 'Overpass Stereo', exact: true }).waitFor()
    await page.evaluate(async () => window.navigation.transition?.finished)
    await page.getByRole('button', { name: 'Next image' }).click()
    await page.waitForURL('**/albums/overpass-stereo?image=2')
    assert.equal(
      await page
        .getByRole('heading', { name: 'Overpass Stereo', exact: true })
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

  it('uses the pending link prefetch when navigating to Contact', async (t) => {
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let requests: (string | null)[] = []
    let page = await t.serve(
      await createTestServer((request) => {
        if (new URL(request.url).pathname === '/contact') {
          let prefetch = request.headers.get('X-Remix-Prefetch')
          requests.push(prefetch)
          if (prefetch === 'true') {
            // Flush a renderable page but keep its request pending until navigation displays it.
            let html =
              '<!doctype html><html><head></head><body><h1>Contact Us</h1></body></html><!-- rmx:flush document -->'
            let body = new Blob([html])
              .stream()
              .pipeThrough(new TransformStream({ flush: () => release.promise }))
            return new Response(body, {
              headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' },
            })
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
    await prefetched
    await link.click()
    await page.getByRole('heading', { name: 'Contact Us', exact: true }).waitFor()
    assert.deepEqual(requests, ['true'])
  })

  it('keeps an unfinished shared asset prefetch connected through frame navigation', async (t) => {
    let scriptHref = await assets.getHref(
      fileURLToPath(new URL('./actions/albums/public/image-carousel.tsx', import.meta.url)),
    )
    let started = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let requests = 0
    let page = await t.serve(
      await createTestServer(async (request) => {
        let pathname = new URL(request.url).pathname
        // Other visible album cards share this script. Keep their prefetches from starting it
        // before the album retained below has discovered its assets.
        if (
          request.headers.get('X-Remix-Prefetch') === 'true' &&
          pathname.startsWith('/albums/') &&
          pathname !== '/albums/overpass-stereo'
        ) {
          await release.promise
        }
        if (pathname === scriptHref) {
          requests++
          started.resolve()
          await release.promise
        }
        return router.fetch(request)
      }),
    )
    let prefetched = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/albums/overpass-stereo',
    )
    await page.goto('/albums/genre/rock')
    await waitForNavigationRuntime(page)
    let link = page
      .locator('a[data-rmx-prefetch="viewport"][href="/albums/overpass-stereo"]')
      .first()
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
        prefetch('/albums/overpass-stereo')
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
    await page.getByRole('heading', { level: 1, name: 'Overpass Stereo', exact: true }).waitFor()
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
    await page.waitForURL('**/albums/overpass-stereo?image=2')
    assert.equal(requests, 1)
    assert.deepEqual(failedAssets, [])
  })

  it('prefetches mobile faceout and related covers on card hover and reuses them on navigation', async (t) => {
    let requests: Request[] = []
    let images: string[] = []
    let page = await t.serve(
      await createTestServer((request) => {
        let url = new URL(request.url)
        if (url.pathname.startsWith('/albums/')) requests.push(request)
        if (url.pathname.startsWith('/assets/app/images/')) images.push(url.pathname + url.search)
        return router.fetch(request)
      }),
    )
    let errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width: 412, height: 823 })
    let supportsAssetPrefetch = await prefetchesAssets(page)
    let faceout = supportsAssetPrefetch
      ? page.waitForResponse((response) => {
          let url = new URL(response.url())
          return (
            url.pathname.includes('/overpass-stereo-1.') &&
            url.search === '?transform=album-image-320'
          )
        })
      : undefined
    let mainPage = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/albums/overpass-stereo',
    )
    await page.goto('/search?q=Overpass%20Stereo')
    await waitForNavigationRuntime(page)
    await (await mainPage).finished()
    // HTML can finish before idle asset discovery creates any prefetch hints.
    if (faceout) await (await faceout).finished()
    await page.waitForFunction(
      () => !document.querySelector('head link[rel="prefetch"], [data-responsive-prefetch]'),
    )
    assert.deepEqual(
      requests.map((request) => new URL(request.url).pathname),
      ['/albums/overpass-stereo'],
    )
    if (supportsAssetPrefetch) {
      assert.deepEqual(
        images
          .filter((href) => href.includes('/overpass-stereo-1.'))
          .map((href) => new URL(href, page.url()).search)
          .sort(),
        ['?transform=album-image-320', '?transform=album-image-480'],
      )
    }
    assert.equal(
      images.some((href) => /\/overpass-stereo-[23]\./.test(href)),
      false,
    )

    let related = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/albums/overpass-stereo/related',
    )
    let coverResponses = supportsAssetPrefetch
      ? ['shred-till-dawn', 'dial-up-heartbreak', 'dial-up-heartbreak'].map((slug) =>
          page.waitForResponse((response) =>
            new URL(response.url()).pathname.includes(`/${slug}-1.`),
          ),
        )
      : []
    let card = page.locator('[data-test-slug="overpass-stereo"]')
    await card.getByText('by Mile Marker Club', { exact: true }).hover()
    await (await related).finished()
    await Promise.all(coverResponses.map(async (response) => (await response).finished()))
    await page.waitForFunction(
      () => !document.querySelector('head link[rel="prefetch"], [data-responsive-prefetch]'),
    )
    assert.equal(requests[1].headers.get('X-Remix-Prefetch'), 'true')
    assert.equal(requests[1].headers.get('X-Remix-Target'), 'related-albums-1')
    assert.equal(await page.locator('[data-test-slug]').count(), 1)
    assert.deepEqual(
      requests.map((request) => new URL(request.url).pathname),
      ['/albums/overpass-stereo', '/albums/overpass-stereo/related'],
    )
    if (supportsAssetPrefetch) {
      assert.equal(images.filter((href) => !href.includes('/overpass-stereo-')).length, 2)
      assert.ok(
        images.every((href) => /\?transform=album-image-(?:320|480|640|768|960)$/.test(href)),
      )
    }

    await card.getByRole('heading', { name: 'Overpass Stereo', exact: true }).hover()
    await page.mouse.move(0, 0)
    let details = card.getByRole('link', { name: 'View Details', exact: true })
    await details.focus()
    await card.hover()
    await details.click()
    await page.getByRole('heading', { level: 1, name: 'Overpass Stereo', exact: true }).waitFor()
    let section = page.getByRole('region', { name: 'Related Records', exact: true })
    await section.scrollIntoViewIfNeeded()
    await section.getByRole('heading', { name: 'Dial-Up Heartbreak', exact: true }).waitFor()
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
    assert.ok(chosen.every((href) => href.endsWith('?transform=album-image-480')))
    assert.equal(
      requests.filter(
        (request) => new URL(request.url).pathname === '/albums/overpass-stereo/related',
      ).length,
      reusesCachedHtml(page) ? 1 : 2,
    )
    if (supportsAssetPrefetch) {
      for (let href of chosen) assert.equal(images.filter((request) => request === href).length, 1)
    }
    assert.deepEqual(errors, [])
  })

  it(
    'joins a pending related-albums prefetch when the details page loads its lazy frame',
    { timeout: 30_000 },
    async (t) => {
      let requested = Promise.withResolvers<void>()
      let release = Promise.withResolvers<void>()
      t.after(() => release.resolve())
      let relatedRequests: Request[] = []
      let page = await t.serve(
        await createTestServer(async (request) => {
          if (new URL(request.url).pathname === '/albums/overpass-stereo/related') {
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
        (response) => new URL(response.url()).pathname === '/albums/overpass-stereo',
      )
      await page.goto('/search?q=Overpass%20Stereo')
      await waitForNavigationRuntime(page)
      await page
        .getByRole('link', { name: 'Overpass Stereo', exact: true })
        .scrollIntoViewIfNeeded()
      await (await detailsPrefetched).finished()
      let card = page.locator('[data-test-slug="overpass-stereo"]')
      await card.getByRole('link', { name: 'View Details', exact: true }).focus()
      await requested.promise
      await card
        .getByRole('link', { name: 'View Details', exact: true })
        .evaluate((anchor: HTMLAnchorElement) => anchor.click())
      await page.getByRole('heading', { level: 1, name: 'Overpass Stereo', exact: true }).waitFor()
      await page.evaluate(async () => window.navigation.transition?.finished)
      let related = page.getByRole('region', { name: 'Related Records', exact: true })
      await related.scrollIntoViewIfNeeded()
      await related.getByRole('heading', { name: 'Dial-Up Heartbreak', exact: true }).waitFor()
      release.resolve()
      assert.equal(relatedRequests.length, 1)
      assert.equal(relatedRequests[0].headers.get('X-Remix-Prefetch'), 'true')
      assert.equal(relatedRequests[0].headers.get('X-Remix-Target'), 'related-albums-1')
      assert.deepEqual(errors, [])
    },
  )

  it('respects Save-Data on card hover and prefetches on keyboard focus when enabled', async (t) => {
    let requests = 0
    let page = await t.serve(
      await createTestServer((request) => {
        if (new URL(request.url).pathname === '/albums/overpass-stereo/related') requests++
        return router.fetch(request)
      }),
    )
    await page.goto('/search?q=Overpass%20Stereo')
    await waitForNavigationRuntime(page)
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'connection', {
        configurable: true,
        value: { saveData: true },
      })
    })
    let card = page.locator('[data-test-slug="overpass-stereo"]')
    await card.getByText('by Mile Marker Club', { exact: true }).hover()
    assert.equal(requests, 0)
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'connection', {
        configurable: true,
        value: { saveData: false },
      })
    })
    let related = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/albums/overpass-stereo/related',
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
        if (pathname === '/albums/overpass-stereo') {
          requests.push(request)
          requested.resolve()
          await release.promise
        }
        if (pathname === '/albums/overpass-stereo/related') requests.push(request)
        return router.fetch(request)
      }),
    )
    await page.goto('/search?q=Overpass%20Stereo')
    await waitForNavigationRuntime(page)
    await requested.promise
    let card = page.locator('[data-test-slug="overpass-stereo"]')
    await card.getByText('by Mile Marker Club', { exact: true }).hover()
    await card.getByRole('link', { name: 'View Details', exact: true }).focus()
    assert.equal(requests.length, 1)
    let related = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/albums/overpass-stereo/related',
    )
    release.resolve()
    await (await related).finished()
    assert.deepEqual(
      requests.map((request) => new URL(request.url).pathname),
      ['/albums/overpass-stereo', '/albums/overpass-stereo/related'],
    )
    assert.equal(requests[1].headers.get('X-Remix-Target'), 'related-albums-1')
  })

  it('cancels pending card discovery when its link is removed without starting queued frames', async (t) => {
    let requested = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let relatedRequests = 0
    let page = await t.serve(
      await createTestServer(async (request) => {
        let pathname = new URL(request.url).pathname
        if (pathname === '/albums/overpass-stereo') {
          requested.resolve()
          await release.promise
        }
        if (pathname === '/albums/overpass-stereo/related') relatedRequests++
        return router.fetch(request)
      }),
    )
    await page.goto('/search?q=Overpass%20Stereo')
    await waitForNavigationRuntime(page)
    await requested.promise
    let card = page.locator('[data-test-slug="overpass-stereo"]')
    await card.getByText('by Mile Marker Club', { exact: true }).hover()
    let canceled = page.waitForEvent('requestfailed', {
      predicate: (request) => new URL(request.url()).pathname === '/albums/overpass-stereo',
    })
    await card.evaluate((card) => card.remove())
    await canceled
    release.resolve()
    await page.goto('/about')
    await waitForNavigationRuntime(page)
    assert.equal(relatedRequests, 0)
  })

  it('prefetches visible album covers before their details buttons and does not repeat on viewport reentry', async (t) => {
    let requests: string[] = []
    let page = await t.serve(
      await createTestServer((request) => {
        let url = new URL(request.url)
        if (url.pathname.startsWith('/albums/')) requests.push(url.pathname + url.search)
        return router.fetch(request)
      }),
    )
    let discoveries: string[] = []
    page.on('request', (request) => {
      let url = new URL(request.url())
      if (url.pathname.startsWith('/albums/')) discoveries.push(url.pathname + url.search)
    })
    await page.setViewportSize({ width: 1000, height: 400 })
    await page.goto('/about')
    await waitForNavigationRuntime(page)
    await page.getByRole('banner').getByRole('link', { name: 'Records', exact: true }).click()
    await page.getByRole('heading', { name: 'Browse Records', exact: true }).waitFor()

    let link = page.getByRole('link', { name: 'Overpass Stereo', exact: true })
    assert.equal(await isInViewport(link), false)
    assert.equal(requests.includes('/albums/overpass-stereo'), false)

    let prefetched = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/albums/overpass-stereo',
    )
    await link.evaluate((anchor) => anchor.scrollIntoView({ block: 'start' }))
    assert.equal(await isInViewport(page.locator('a.btn[href="/albums/overpass-stereo"]')), false)
    await (await prefetched).finished()
    await page.waitForFunction(() => !document.querySelector('head link[rel="prefetch"]'))
    await page.getByRole('banner').scrollIntoViewIfNeeded()
    assert.equal(await isInViewport(link), false)
    await link.scrollIntoViewIfNeeded()
    assert.equal(await isInViewport(link), true)
    assert.equal(requests.filter((path) => path === '/albums/overpass-stereo').length, 1)
    assert.equal(discoveries.filter((path) => path === '/albums/overpass-stereo').length, 1)

    let changed = page.waitForResponse(
      (response) => new URL(response.url()).search === '?from=changed-link',
    )
    await link.evaluate((anchor) =>
      anchor.setAttribute('href', '/albums/last-bell-first-kiss?from=changed-link'),
    )
    await (await changed).finished()
    assert.equal(
      requests.filter((path) => path === '/albums/last-bell-first-kiss?from=changed-link').length,
      1,
    )
    let related = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/albums/last-bell-first-kiss/related',
    )
    await link.hover()
    let relatedResponse = await related
    await relatedResponse.finished()
    assert.equal(relatedResponse.request().headers()['x-remix-target'], 'related-albums-3')
    assert.equal(requests.includes('/albums/overpass-stereo/related'), false)
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
