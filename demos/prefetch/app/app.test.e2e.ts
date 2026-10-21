import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { Page } from 'playwright'

import { router } from './router.ts'
import { routes } from './routes.ts'
import { assets } from './utils/assets.ts'

describe('prefetch demo', () => {
  it('prefetches render links at startup and reuses their HTML on navigation', async (t) => {
    let productHref = routes.product.href({ slug: 'canvas-tote' })
    let requests = 0
    let page = await t.serve(
      await createTestServer((request) => {
        if (new URL(request.url).pathname === productHref) requests++
        return router.fetch(request)
      }),
    )
    let prefetched = page.waitForResponse(productHref)
    await page.goto(routes.home.href(undefined, { searchParams: { prefetch: 'render' } }))
    await (await prefetched).finished()
    assert.equal(await page.getByRole('heading', { name: 'Catalog', exact: true }).count(), 1)

    await page.getByRole('link', { name: /Canvas Tote/ }).click()
    await page.getByRole('heading', { name: 'Canvas Tote' }).waitFor()
    assert.equal(requests, 1)
  })

  it('discovers viewport links after frame navigation and prefetches when scrolled into view', async (t) => {
    let productHref = routes.product.href({ slug: 'canvas-tote' })
    let requests = 0
    let page = await t.serve(
      await createTestServer((request) => {
        if (new URL(request.url).pathname === productHref) requests++
        return router.fetch(request)
      }),
    )
    await page.goto(routes.home.href())
    await waitForNavigationRuntime(page)
    await page
      .getByRole('navigation', { name: 'Prefetch mode' })
      .getByRole('link', { name: 'Viewport' })
      .click()
    await page.getByRole('heading', { name: 'Prefetched on viewport' }).waitFor()
    let link = page.getByRole('link', { name: /Canvas Tote/ })
    assert.ok(await link.evaluate((anchor) => anchor.getBoundingClientRect().top > innerHeight))
    assert.equal(requests, 0)

    let prefetched = page.waitForResponse(productHref)
    await link.scrollIntoViewIfNeeded()
    await (await prefetched).finished()
    await link.click()
    await page.getByRole('heading', { name: 'Canvas Tote' }).waitFor()
    assert.equal(requests, 1)
  })

  it('warms assets even when HTML cannot be cached and fetches HTML again on navigation', async (t) => {
    let productHref = routes.product.href({ slug: 'enamel-mug' })
    let scriptHref = await assets.getHref(
      new URL('./actions/public/product-quantity.tsx', import.meta.url).pathname,
    )
    let styleHref = await assets.getHref(
      new URL('./actions/public/product.css', import.meta.url).pathname,
    )
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let requested: string[] = []
    let productRequests: Request[] = []
    let page = await t.serve(
      await createTestServer(async (request) => {
        let pathname = new URL(request.url).pathname
        requested.push(pathname)
        if (pathname === productHref) productRequests.push(request)
        if (pathname === scriptHref || pathname === styleHref) await release.promise
        return router.fetch(request)
      }),
    )
    await page.goto('/')
    await waitForNavigationRuntime(page)
    let prefetched = page.waitForResponse(productHref)
    await page.getByRole('searchbox', { name: 'Search products' }).fill('mug')
    assert.equal((await prefetched).headers()['cache-control'], 'no-store')
    await page.locator(`head link[rel="prefetch"][href$="${scriptHref}"]`).waitFor({
      state: 'attached',
    })
    await page.locator(`head link[rel="prefetch"][href$="${styleHref}"]`).waitFor({
      state: 'attached',
    })
    assert.equal(await page.locator('head link[rel="preload"]').count(), 0)
    assert.equal(await page.getByRole('heading', { name: 'Catalog', exact: true }).count(), 1)
    assert.equal(await page.locator('.product-quantity').count(), 0)

    let warmed = Promise.all([page.waitForResponse(scriptHref), page.waitForResponse(styleHref)])
    release.resolve()
    await warmed
    await page.waitForFunction(() => !document.querySelector('head link[rel="prefetch"]'))
    await page.getByRole('link', { name: 'Enamel Mug', exact: true }).click()
    await page.getByRole('button', { name: 'Add one' }).click()
    await page.waitForFunction(() => document.querySelector('output')?.textContent === '2')
    assert.equal(await page.getByTestId('requested-as').textContent(), 'frame request')
    assert.equal(
      await page
        .locator('.product-quantity')
        .evaluate((element) => getComputedStyle(element).borderLeftColor),
      'rgb(15, 118, 110)',
    )
    assert.deepEqual(
      productRequests.map((request) => ({
        method: request.method,
        frame: request.headers.get('X-Remix-Frame'),
      })),
      [
        { method: 'GET', frame: 'true' },
        { method: 'GET', frame: 'true' },
      ],
    )
    assert.equal(requested.filter((href) => href === scriptHref).length, 1)
    assert.equal(requested.filter((href) => href === styleHref).length, 1)
  })

  it('reuses cacheable discovery HTML through the default resolver', async (t) => {
    let productHref = routes.product.href({ slug: 'canvas-tote' })
    let requests = 0
    let page = await t.serve(
      await createTestServer((request) => {
        if (new URL(request.url).pathname === productHref) requests++
        return router.fetch(request)
      }),
    )
    await page.goto('/')

    let prefetched = page.waitForResponse(productHref)
    await page.getByRole('searchbox', { name: 'Search products' }).fill('tote')
    await (await prefetched).finished()
    await page.getByRole('link', { name: 'Canvas Tote', exact: true }).click()
    await page.getByRole('heading', { name: 'Canvas Tote' }).waitFor()

    assert.equal(await page.getByTestId('requested-as').textContent(), 'frame request')
    assert.equal(requests, 1)
  })

  it('starts a default navigation fetch while discovery HTML is still streaming', async (t) => {
    let productHref = routes.product.href({ slug: 'enamel-mug' })
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let requests = 0
    let page = await t.serve(
      await createTestServer(async (request) => {
        if (new URL(request.url).pathname === productHref) {
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
    await page.goto('/')

    let prefetched = page.waitForResponse(productHref)
    await page.getByRole('searchbox', { name: 'Search products' }).fill('mug')
    let response = await prefetched
    let navigation = page.waitForRequest(
      (request) =>
        new URL(request.url()).pathname === productHref &&
        request.headers()['x-remix-frame'] === 'true',
    )
    await page.getByRole('link', { name: 'Enamel Mug', exact: true }).click()
    await navigation
    // Browsers may serialize overlapping fetches, so let discovery finish after navigation starts.
    release.resolve()
    await response.finished()
    await page.getByRole('heading', { name: 'Enamel Mug' }).waitFor()
    assert.equal(await page.getByTestId('requested-as').textContent(), 'frame request')
    assert.equal(requests, 2)
  })

  it('opens a hovered product from the prefetched response', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.home.href())
    await waitForNavigationRuntime(page)

    let link = page.getByRole('link', { name: /Canvas Tote/ })
    let prefetched = page.waitForResponse(routes.product.href({ slug: 'canvas-tote' }))
    await link.hover()
    await prefetched
    await link.click()

    await page.getByRole('heading', { name: 'Canvas Tote' }).waitFor()
    assert.equal(await page.getByTestId('requested-as').textContent(), 'frame request')
  })

  it('loads products without the attribute when they are clicked', async (t) => {
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.home.href())
    await waitForNavigationRuntime(page)

    await page.getByRole('link', { name: /Brass Keyring/ }).click()

    await page.getByRole('heading', { name: 'Brass Keyring' }).waitFor()
    assert.equal(await page.getByTestId('requested-as').textContent(), 'frame request')
  })

  it('warms destination-only JavaScript and CSS before clicking and uses them on navigation', async (t) => {
    let scriptHref = await assets.getHref(
      new URL('./actions/public/product-quantity.tsx', import.meta.url).pathname,
    )
    let styleHref = await assets.getHref(
      new URL('./actions/public/product.css', import.meta.url).pathname,
    )
    let requested: string[] = []
    let page = await t.serve(
      await createTestServer((request) => {
        requested.push(new URL(request.url).pathname)
        return router.fetch(request)
      }),
    )
    await page.goto(routes.home.href())
    await waitForNavigationRuntime(page)
    assert.ok(!requested.includes(scriptHref))
    assert.ok(!requested.includes(styleHref))

    let warmed = Promise.all([page.waitForResponse(scriptHref), page.waitForResponse(styleHref)])
    let link = page.getByRole('link', { name: /Canvas Tote/ })
    await link.hover()
    await warmed
    assert.equal(await page.getByRole('heading', { name: 'Catalog', exact: true }).count(), 1)
    assert.equal(await page.locator('.product-quantity').count(), 0)

    await link.click()
    await page.getByRole('button', { name: 'Add one' }).click()
    await page.waitForFunction(() => document.querySelector('output')?.textContent === '2')
    assert.equal(
      await page
        .locator('.product-quantity')
        .evaluate((element) => getComputedStyle(element).borderLeftColor),
      'rgb(15, 118, 110)',
    )
    assert.equal(requested.filter((href) => href === scriptHref).length, 1)
    assert.equal(requested.filter((href) => href === styleHref).length, 1)
  })

  it('keeps the loaded application entry through prefetch and product navigation', async (t) => {
    let entryHref = await assets.getHref(
      new URL('./actions/public/entry.tsx', import.meta.url).pathname,
    )
    let page = await t.serve(await createTestServer(router.fetch))
    await page.goto(routes.home.href())
    await page.waitForFunction(() =>
      document.querySelector('input[type=search]')?.matches(':enabled'),
    )
    let entryRequests: string[] = []
    let failedAssets: string[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === entryHref) entryRequests.push(request.resourceType())
    })
    page.on('requestfailed', (request) => {
      if (new URL(request.url()).pathname.startsWith('/assets/')) failedAssets.push(request.url())
    })

    let prefetched = page.waitForResponse(routes.product.href({ slug: 'canvas-tote' }))
    let link = page.getByRole('link', { name: /Canvas Tote/ })
    await link.hover()
    await (await prefetched).finished()
    await link.click()
    await page.getByRole('button', { name: 'Add one' }).click()
    await page.waitForFunction(() => document.querySelector('output')?.textContent === '2')

    assert.deepEqual(entryRequests, [])
    assert.deepEqual(failedAssets, [])
  })

  it('lets an unfinished asset prefetch complete through product navigation', async (t) => {
    let scriptHref = await assets.getHref(
      new URL('./actions/public/product-quantity.tsx', import.meta.url).pathname,
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
    await page.goto(routes.home.href())
    await page.waitForFunction(() =>
      document.querySelector('input[type=search]')?.matches(':enabled'),
    )
    let failedAssets: string[] = []
    page.on('requestfailed', (request) => {
      if (new URL(request.url()).pathname.startsWith('/assets/')) failedAssets.push(request.url())
    })

    let link = page.getByRole('link', { name: /Canvas Tote/ })
    await link.hover()
    await started.promise
    await link.click()
    await page.waitForFunction(() => document.title === 'Canvas Tote | Prefetch Demo')
    assert.equal(await page.locator(`head link[rel="prefetch"][href$="${scriptHref}"]`).count(), 1)
    release.resolve()
    await page.getByRole('button', { name: 'Add one' }).click()
    await page.waitForFunction(() => document.querySelector('output')?.textContent === '2')

    assert.equal(requests, 1)
    assert.deepEqual(failedAssets, [])
  })
})

async function waitForNavigationRuntime(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    let state = window.navigation.currentEntry?.getState()
    return typeof state === 'object' && state != null && '$rmx' in state
  })
}
