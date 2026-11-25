import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'
import type { Page, Request as BrowserRequest } from 'playwright'
import sharp from 'sharp'

import { createTestRouter, expectSelectedImage } from '../../../test/helpers.ts'

// Bound the whole file, including cleanup, without keeping successful workers alive.
setTimeout(() => {
  diagnostic('FILE DEADLINE', {
    pending: [...pendingRequests.values()],
    server: [...serverRequests],
  })
  console.error('image-carousel.test.e2e.ts timed out after 90000ms')
  process.exit(1)
}, 90_000).unref()

describe('album image selection', () => {
  it('navigates with image dots and keeps their current state in sync with scrolling', async (t) => {
    diagnostic(
      'TEST START',
      'navigates with image dots and keeps their current state in sync with scrolling',
    )
    diagnostic('STEP', 'let page = await serveDiagnostic(t, await createTestRouter())')
    let page = await serveDiagnostic(t, await createTestRouter())
    diagnostic('STEP', "await page.emulateMedia({ reducedMotion: 'reduce' })")
    await page.emulateMedia({ reducedMotion: 'reduce' })
    diagnostic('STEP', "await page.goto('/albums/overpass-stereo?campaign=dots&image=2#details')")
    await page.goto('/albums/overpass-stereo?campaign=dots&image=2#details')
    let dots = page.getByRole('group', { name: 'Choose image', exact: true })
    assert.equal(await dots.getByRole('button').count(), 3)
    let second = dots.getByRole('button', { name: 'Show image 2 of 3' })
    let third = dots.getByRole('button', { name: 'Show image 3 of 3' })
    assert.equal(await second.getAttribute('aria-current'), 'true')
    let entry = await page.locator('script[type="module"][src]').getAttribute('src')
    assert.ok(entry)
    diagnostic('STEP', 'await page.evaluate(async (href) => {')
    await page.evaluate(async (href) => {
      let { app } = await import(href)
      await app.ready()
    }, entry)
    diagnostic('STEP', 'await third.click()')
    await third.click()
    diagnostic(
      'STEP',
      "await page.waitForURL('**/albums/overpass-stereo?campaign=dots&image=3#details')",
    )
    await page.waitForURL('**/albums/overpass-stereo?campaign=dots&image=3#details')
    diagnostic('STEP', 'await expectSelectedImage(page, 3)')
    await expectSelectedImage(page, 3)
    assert.equal(await third.getAttribute('aria-current'), 'true')
    assert.equal(await second.getAttribute('aria-current'), null)

    let track = page.getByRole('group', { name: 'Images', exact: true })
    assert.equal(await track.evaluate((node) => getComputedStyle(node).scrollbarWidth), 'none')
    diagnostic(
      'STEP',
      "await track.evaluate((node) => node.scrollTo({ left: 0, behavior: 'instant' }))",
    )
    await track.evaluate((node) => node.scrollTo({ left: 0, behavior: 'instant' }))
    diagnostic('STEP', "await page.waitForURL('**/albums/overpass-stereo?campaign=dots#details')")
    await page.waitForURL('**/albums/overpass-stereo?campaign=dots#details')
    assert.equal(
      await dots.getByRole('button', { name: 'Show image 1 of 3' }).getAttribute('aria-current'),
      'true',
    )
    diagnostic('STEP', 'await second.focus()')
    await second.focus()
    diagnostic('STEP', "await second.press('Space')")
    await second.press('Space')
    diagnostic(
      'STEP',
      "await page.waitForURL('**/albums/overpass-stereo?campaign=dots&image=2#details')",
    )
    await page.waitForURL('**/albums/overpass-stereo?campaign=dots&image=2#details')
    diagnostic('STEP', 'await expectSelectedImage(page, 2)')
    await expectSelectedImage(page, 2)
    assert.equal(await second.evaluate((node) => node === document.activeElement), true)
  })

  it('supports keyboard controls and native scrolling with reduced motion', async (t) => {
    diagnostic('TEST START', 'supports keyboard controls and native scrolling with reduced motion')
    diagnostic('STEP', 'let page = await serveDiagnostic(t, await createTestRouter())')
    let page = await serveDiagnostic(t, await createTestRouter())
    diagnostic('STEP', "await page.emulateMedia({ reducedMotion: 'reduce' })")
    await page.emulateMedia({ reducedMotion: 'reduce' })
    diagnostic('STEP', "await page.goto('/albums/overpass-stereo?image=2')")
    await page.goto('/albums/overpass-stereo?image=2')
    let carousel = page.getByRole('region', { name: 'Record images' })
    assert.equal(await carousel.count(), 1)
    let track = carousel.getByRole('group', { name: 'Images' })
    diagnostic('STEP', 'await track.and(page.locator(\'[tabindex="0"]\')).waitFor()')
    await track.and(page.locator('[tabindex="0"]')).waitFor()
    let next = carousel.getByRole('button', { name: 'Next image' })
    let previous = carousel.getByRole('button', { name: 'Previous image' })
    diagnostic('STEP', 'await expectSelectedImage(page, 2)')
    await expectSelectedImage(page, 2)
    assert.equal(await carousel.getByRole('status').textContent(), '')
    diagnostic('STEP', 'await next.focus()')
    await next.focus()
    diagnostic('STEP', "await next.press('Enter')")
    await next.press('Enter')
    diagnostic('STEP', "await page.waitForURL('**/albums/overpass-stereo?image=3')")
    await page.waitForURL('**/albums/overpass-stereo?image=3')
    diagnostic('STEP', 'await expectSelectedImage(page, 3)')
    await expectSelectedImage(page, 3)
    assert.equal(await previous.evaluate((node) => node === document.activeElement), true)
    assert.notEqual(await previous.evaluate((node) => getComputedStyle(node).outlineStyle), 'none')
    assert.equal(await carousel.getByRole('status').textContent(), 'Image 3 of 3')
    diagnostic('STEP', 'await page.setViewportSize({ width: 360, height: 800 })')
    await page.setViewportSize({ width: 360, height: 800 })
    diagnostic('STEP', 'await expectSelectedImage(page, 3)')
    await expectSelectedImage(page, 3)

    diagnostic(
      'STEP',
      "await track.evaluate((node) => node.scrollTo({ left: 0, behavior: 'instant' }))",
    )
    await track.evaluate((node) => node.scrollTo({ left: 0, behavior: 'instant' }))
    diagnostic('STEP', "await page.waitForURL('**/albums/overpass-stereo')")
    await page.waitForURL('**/albums/overpass-stereo')
    diagnostic('STEP', 'await expectSelectedImage(page, 1)')
    await expectSelectedImage(page, 1)
    assert.equal(await carousel.getByRole('status').textContent(), 'Image 1 of 3')
    diagnostic('STEP', 'await track.focus()')
    await track.focus()
    diagnostic('STEP', "await track.press('ArrowRight')")
    await track.press('ArrowRight')
    diagnostic('STEP', "await page.waitForURL('**/albums/overpass-stereo?image=2')")
    await page.waitForURL('**/albums/overpass-stereo?image=2')
    diagnostic('STEP', 'await expectSelectedImage(page, 2)')
    await expectSelectedImage(page, 2)
  })

  it('handles rapid navigation when scrollend is unavailable', async (t) => {
    diagnostic('TEST START', 'handles rapid navigation when scrollend is unavailable')
    diagnostic('STEP', 'let page = await serveDiagnostic(t, await createTestRouter())')
    let page = await serveDiagnostic(t, await createTestRouter())
    diagnostic('STEP', 'await page.addInitScript(() => {')
    await page.addInitScript(() => {
      Reflect.deleteProperty(Element.prototype, 'onscrollend')
      Reflect.deleteProperty(HTMLElement.prototype, 'onscrollend')
    })
    diagnostic('STEP', "await page.goto('/albums/overpass-stereo')")
    await page.goto('/albums/overpass-stereo')
    let entry = await page.locator('script[type="module"][src]').getAttribute('src')
    assert.ok(entry)
    diagnostic('STEP', 'await page.evaluate(async (href) => {')
    await page.evaluate(async (href) => {
      let { app } = await import(href)
      await app.ready()
    }, entry)
    let track = page.getByRole('group', { name: 'Images', exact: true })
    assert.equal(await track.evaluate((node) => 'onscrollend' in node), false)
    let next = page.getByRole('button', { name: 'Next image' })
    diagnostic('STEP', 'await next.click()')
    await next.click()
    diagnostic('STEP', 'await next.click()')
    await next.click()
    diagnostic('STEP', "await page.waitForURL('**/albums/overpass-stereo?image=3')")
    await page.waitForURL('**/albums/overpass-stereo?image=3')
    diagnostic('STEP', 'await expectSelectedImage(page, 3)')
    await expectSelectedImage(page, 3)
    assert.equal(
      await page.getByRole('region', { name: 'Record images' }).getByRole('status').textContent(),
      'Image 3 of 3',
    )
  })

  it('searches the catalog through a labeled search field', async (t) => {
    diagnostic('TEST START', 'searches the catalog through a labeled search field')
    diagnostic('STEP', 'let page = await serveDiagnostic(t, await createTestRouter())')
    let page = await serveDiagnostic(t, await createTestRouter())
    diagnostic('STEP', "await page.goto('/albums')")
    await page.goto('/albums')
    let main = page.getByRole('main')
    let search = main.getByRole('searchbox', { name: 'Search records', exact: true })
    assert.equal(await search.count(), 1)
    diagnostic('STEP', "await search.fill('Overpass Stereo')")
    await search.fill('Overpass Stereo')
    diagnostic('STEP', "await main.getByRole('button', { name: 'Search', exact: true }).click()")
    await main.getByRole('button', { name: 'Search', exact: true }).click()
    diagnostic('STEP', "await page.waitForURL('**/search?q=Overpass*')")
    await page.waitForURL('**/search?q=Overpass*')
    assert.equal(await page.locator('[data-test-slug="overpass-stereo"]').count(), 1)
    assert.equal(
      await main.getByRole('searchbox', { name: 'Search records', exact: true }).inputValue(),
      'Overpass Stereo',
    )
  })

  it('updates the URL without fetching and preserves selection through reloads and Back', async (t) => {
    diagnostic(
      'TEST START',
      'updates the URL without fetching and preserves selection through reloads and Back',
    )
    let router = await createTestRouter({ albumIds: [1, 2, 3] })
    let requests: URL[] = []
    let pageErrors: string[] = []
    diagnostic('STEP', 'let page = await serveDiagnostic(t, { fetch(request: Request) {')
    let page = await serveDiagnostic(t, {
      fetch(request: Request) {
        let url = new URL(request.url)
        if (url.pathname === '/albums/overpass-stereo') requests.push(url)
        return router.fetch(request)
      },
    })
    page.on('pageerror', (error) => pageErrors.push(error.message))
    diagnostic('STEP', "await page.goto('/albums/overpass-stereo?campaign=spring#details')")
    await page.goto('/albums/overpass-stereo?campaign=spring#details')
    let entry = await page.locator('script[type="module"][src]').getAttribute('src')
    assert.ok(entry)
    diagnostic('STEP', 'await page.evaluate(async (href) => {')
    await page.evaluate(async (href) => {
      let { app } = await import(href)
      await app.ready()
    }, entry)
    let historyIndex = await page.evaluate(() => window.navigation.currentEntry?.index)
    let next = page.getByRole('button', { name: 'Next image' })
    let previous = page.getByRole('button', { name: 'Previous image' })

    diagnostic('STEP', 'await next.click()')
    await next.click()
    diagnostic(
      'STEP',
      "await page.waitForURL('**/albums/overpass-stereo?campaign=spring&image=2#details')",
    )
    await page.waitForURL('**/albums/overpass-stereo?campaign=spring&image=2#details')
    diagnostic('STEP', 'await expectSelectedImage(page, 2)')
    await expectSelectedImage(page, 2)
    diagnostic('STEP', 'await next.click()')
    await next.click()
    diagnostic(
      'STEP',
      "await page.waitForURL('**/albums/overpass-stereo?campaign=spring&image=3#details')",
    )
    await page.waitForURL('**/albums/overpass-stereo?campaign=spring&image=3#details')
    diagnostic('STEP', 'await expectSelectedImage(page, 3)')
    await expectSelectedImage(page, 3)
    assert.equal(await next.isDisabled(), true)
    diagnostic('STEP', 'await previous.click()')
    await previous.click()
    diagnostic(
      'STEP',
      "await page.waitForURL('**/albums/overpass-stereo?campaign=spring&image=2#details')",
    )
    await page.waitForURL('**/albums/overpass-stereo?campaign=spring&image=2#details')
    diagnostic('STEP', 'await previous.click()')
    await previous.click()
    diagnostic('STEP', "await page.waitForURL('**/albums/overpass-stereo?campaign=spring#details')")
    await page.waitForURL('**/albums/overpass-stereo?campaign=spring#details')
    diagnostic('STEP', 'await expectSelectedImage(page, 1)')
    await expectSelectedImage(page, 1)
    assert.equal(await previous.isDisabled(), true)
    assert.equal(requests.length, 1)
    assert.equal(await page.evaluate(() => window.navigation.currentEntry?.index), historyIndex)

    diagnostic('STEP', 'await next.click()')
    await next.click()
    diagnostic(
      'STEP',
      "await page.waitForURL('**/albums/overpass-stereo?campaign=spring&image=2#details')",
    )
    await page.waitForURL('**/albums/overpass-stereo?campaign=spring&image=2#details')
    diagnostic('STEP', 'await page.evaluate(async (href) => {')
    await page.evaluate(async (href) => {
      let { app } = await import(href)
      await app.frames.top.reload()
    }, entry)
    diagnostic('STEP', 'await expectSelectedImage(page, 2)')
    await expectSelectedImage(page, 2)
    assert.equal(requests.at(-1)?.searchParams.get('image'), '2')
    diagnostic('STEP', 'await page.reload()')
    await page.reload()
    diagnostic('STEP', 'await expectSelectedImage(page, 2)')
    await expectSelectedImage(page, 2)
    diagnostic(
      'STEP',
      "await page.getByRole('banner').getByRole('link', { name: 'Records', exact: true }).click()",
    )
    await page.getByRole('banner').getByRole('link', { name: 'Records', exact: true }).click()
    diagnostic(
      'STEP',
      "await page.getByRole('heading', { name: 'Browse Records', exact: true }).waitFor()",
    )
    await page.getByRole('heading', { name: 'Browse Records', exact: true }).waitFor()
    diagnostic('STEP', 'await page.goBack()')
    await page.goBack()
    diagnostic(
      'STEP',
      "await page.waitForURL('**/albums/overpass-stereo?campaign=spring&image=2#details')",
    )
    await page.waitForURL('**/albums/overpass-stereo?campaign=spring&image=2#details')
    diagnostic('STEP', 'await expectSelectedImage(page, 2)')
    await expectSelectedImage(page, 2)
    assert.deepEqual(pageErrors, [])
  })
})

const diagnosticStart = performance.now()
const pendingRequests = new Map<BrowserRequest, string>()
const serverRequests = new Map<number, string>()
let requestId = 0
let currentStage: unknown
setInterval(
  () =>
    diagnostic('PROGRESS', {
      stage: currentStage,
      pending: [...pendingRequests.values()],
      server: [...serverRequests],
      sharp: sharp.counters(),
      memory: process.memoryUsage(),
    }),
  5000,
).unref()

function diagnostic(event: string, detail?: unknown) {
  if (event === 'STEP' || event === 'TEST START') currentStage = detail
  console.log(
    'CAROUSEL',
    JSON.stringify({ ms: Math.round(performance.now() - diagnosticStart), event, detail }),
  )
}

async function serveDiagnostic(
  t: TestContext,
  router: { fetch(request: Request): Promise<Response> },
) {
  let page: Page
  t.after(async () => {
    diagnostic('TEST CLEANUP', {
      pending: [...pendingRequests.values()],
      server: [...serverRequests],
    })
    await snapshot(page)
  })
  page = await t.serve(
    await createTestServer(async (request) => {
      let id = ++requestId
      let url = new URL(request.url)
      let start = performance.now()
      serverRequests.set(id, url.pathname + url.search)
      request.signal.addEventListener('abort', () => serverRequests.delete(id), { once: true })
      let response = await router.fetch(request)
      if (request.headers.get('Sec-Fetch-Dest') === 'document') {
        diagnostic('SERVER HEADERS', {
          url: url.pathname,
          ms: performance.now() - start,
          status: response.status,
        })
      }
      if (!response.body) {
        serverRequests.delete(id)
        return response
      }
      let bytes = 0
      let reader = response.body.getReader()
      let cancelled = false
      return new Response(
        new ReadableStream<Uint8Array>({
          async pull(controller) {
            try {
              let result = await reader.read()
              if (cancelled) return
              if (result.done) {
                serverRequests.delete(id)
                if (request.headers.get('Sec-Fetch-Dest') === 'document')
                  diagnostic('SERVER BODY END', {
                    url: url.pathname,
                    ms: performance.now() - start,
                    bytes,
                  })
                controller.close()
              } else {
                bytes += result.value.byteLength
                controller.enqueue(result.value)
              }
            } catch (error) {
              serverRequests.delete(id)
              diagnostic('SERVER ERROR', { url: url.pathname, error: String(error) })
              controller.error(error)
            }
          },
          cancel(reason) {
            cancelled = true
            serverRequests.delete(id)
            return reader.cancel(reason)
          },
        }),
        response,
      )
    }),
  )
  page.on('request', (request) => pendingRequests.set(request, request.url()))
  page.on('requestfinished', (request) => pendingRequests.delete(request))
  page.on('requestfailed', (request) => {
    pendingRequests.delete(request)
    diagnostic('REQUEST FAILED', { url: request.url(), error: request.failure() })
  })
  page.on('response', (response) => {
    if (response.request().resourceType() === 'document')
      diagnostic('BROWSER HEADERS', { url: response.url(), status: response.status() })
  })
  page.on('domcontentloaded', () => diagnostic('DOM CONTENT LOADED', page.url()))
  page.on('load', () => diagnostic('LOAD', page.url()))
  page.on('pageerror', (error) => diagnostic('PAGE ERROR', error.message))
  return page
}

async function snapshot(page: Page) {
  try {
    diagnostic(
      'BROWSER STATE',
      await page.evaluate(() => ({
        url: location.href,
        readyState: document.readyState,
        timing: performance.getEntriesByType('navigation').map((entry) => entry.toJSON()),
        images: [...document.images]
          .filter((image) => !image.complete)
          .map((image) => ({ src: image.currentSrc, loading: image.loading })),
        frames: document.querySelectorAll('rmx-frame').length,
        resources: performance
          .getEntriesByType('resource')
          .map((entry) => ({ url: entry.name, ms: entry.duration })),
      })),
    )
  } catch (error) {
    diagnostic('SNAPSHOT ERROR', String(error))
  }
}
