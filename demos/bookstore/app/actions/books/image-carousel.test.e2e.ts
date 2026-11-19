import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'
import type { Page } from 'playwright'

import { createTestRouter } from '../../../test/helpers.ts'

describe('book image selection', () => {
  it('updates the URL without fetching and preserves selection through reloads and Back', async (t) => {
    let router = await createTestRouter()
    let requests: URL[] = []
    let pageErrors: string[] = []
    let page = await t.serve(
      await createTestServer((request) => {
        let url = new URL(request.url)
        if (url.pathname === '/books/bbq') requests.push(url)
        return router.fetch(request)
      }),
    )
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto('/books/bbq?campaign=spring#details')
    let entry = await page.locator('script[type="module"][src]').getAttribute('src')
    assert.ok(entry)
    await page.evaluate(async (href) => {
      let { app } = await import(href)
      await app.ready()
    }, entry)
    let historyIndex = await page.evaluate(() => window.navigation.currentEntry?.index)
    let next = page.getByRole('button', { name: 'Next image' })
    let previous = page.getByRole('button', { name: 'Previous image' })

    await next.click()
    await page.waitForURL('**/books/bbq?campaign=spring&image=2#details')
    await expectSelectedImage(page, 2)
    await next.click()
    await page.waitForURL('**/books/bbq?campaign=spring&image=3#details')
    await expectSelectedImage(page, 3)
    assert.equal(await next.isDisabled(), true)
    await previous.click()
    await page.waitForURL('**/books/bbq?campaign=spring&image=2#details')
    await previous.click()
    await page.waitForURL('**/books/bbq?campaign=spring#details')
    await expectSelectedImage(page, 1)
    assert.equal(await previous.isDisabled(), true)
    assert.equal(requests.length, 1)
    assert.equal(await page.evaluate(() => window.navigation.currentEntry?.index), historyIndex)

    await next.click()
    await page.waitForURL('**/books/bbq?campaign=spring&image=2#details')
    await page.evaluate(async (href) => {
      let { app } = await import(href)
      await app.frames.top.reload()
    }, entry)
    await expectSelectedImage(page, 2)
    assert.equal(requests.at(-1)?.searchParams.get('image'), '2')
    await page.reload()
    await expectSelectedImage(page, 2)
    await page.getByRole('link', { name: 'Back to Books' }).click()
    await page.getByRole('heading', { name: 'Browse Books', exact: true }).waitFor()
    await page.goBack()
    await page.waitForURL('**/books/bbq?campaign=spring&image=2#details')
    await expectSelectedImage(page, 2)
    assert.deepEqual(pageErrors, [])
  })

  it('server renders and preloads the requested image with a safe default for invalid values', async (t) => {
    let server = await createTestServer((await createTestRouter()).fetch)
    let runtimePage = await t.serve(server)
    let browser = runtimePage.context().browser()
    assert.ok(browser)
    let context = await browser.newContext({ baseURL: server.baseUrl, javaScriptEnabled: false })
    try {
      let page = await context.newPage()
      await page.goto('/books/bbq?image=3')
      await expectSelectedImage(page, 3)
      assert.equal(await page.getByRole('button', { name: 'Next image' }).isDisabled(), true)
      assert.equal(await page.getByRole('button', { name: 'Previous image' }).isDisabled(), false)
      assert.equal(
        await page.locator('head link[rel="preload"][as="image"]').getAttribute('href'),
        await page.getByRole('img', { name: 'Image 3 of 3' }).getAttribute('src'),
      )
      assert.equal(
        await page.locator('head link[rel="preload"][as="image"]').getAttribute('imagesrcset'),
        await page.getByRole('img', { name: 'Image 3 of 3' }).getAttribute('srcset'),
      )
      assert.equal(
        await page.locator('head link[rel="preload"][as="image"]').getAttribute('imagesizes'),
        await page.getByRole('img', { name: 'Image 3 of 3' }).getAttribute('sizes'),
      )
      assert.equal(
        await page.getByRole('img', { name: 'Image 1 of 3' }).getAttribute('loading'),
        'lazy',
      )

      await page.goto('/books/bbq?image=99')
      await expectSelectedImage(page, 1)
      assert.equal(await page.getByRole('button', { name: 'Previous image' }).isDisabled(), true)
      await page.goto('/books/bbq?image=2.5')
      await expectSelectedImage(page, 1)
    } finally {
      await context.close()
    }
  })

  it('selects mobile image variants and reuses homepage and selected faceout preloads', async (t) => {
    let requests: string[] = []
    let router = await createTestRouter()
    let server = await createTestServer((request) => {
      let url = new URL(request.url)
      if (url.pathname.startsWith('/assets/app/images/')) requests.push(url.pathname + url.search)
      return router.fetch(request)
    })
    let runtimePage = await t.serve(server)
    let browser = runtimePage.context().browser()
    assert.ok(browser)
    let context = await browser.newContext({
      baseURL: server.baseUrl,
      javaScriptEnabled: false,
      viewport: { width: 412, height: 823 },
      deviceScaleFactor: 2,
    })
    try {
      let page = await context.newPage()
      await page.goto('/')
      let cover = page.locator('[data-test-slug] img').first()
      await cover.evaluate((image: HTMLImageElement) => image.decode())
      assert.equal(
        await cover.evaluate((image: HTMLImageElement) => new URL(image.currentSrc).search),
        '?transform=book-image-768',
      )
      let coverSrc = await cover.evaluate((image: HTMLImageElement) => {
        let url = new URL(image.currentSrc)
        return url.pathname + url.search
      })
      assert.deepEqual(
        requests.filter((url) => url.includes('/bbq-1.')),
        [coverSrc],
      )
      requests = []
      await page.goto('/books/bbq?image=3')
      let selected = page.getByRole('img', { name: 'Image 3 of 3' })
      await selected.evaluate((image: HTMLImageElement) => image.decode())
      let currentSrc = await selected.evaluate((image: HTMLImageElement) => {
        let url = new URL(image.currentSrc)
        return url.pathname + url.search
      })
      assert.equal(new URL(currentSrc, server.baseUrl).search, '?transform=book-image-640')
      assert.deepEqual(
        requests.filter((url) => url.includes('/bbq-3.')),
        [currentSrc],
      )
      assert.equal(await selected.evaluate((image) => image.getBoundingClientRect().width), 300)
    } finally {
      await context.close()
    }
  })
})

async function expectSelectedImage(page: Page, imageNumber: number): Promise<void> {
  await page.waitForFunction((selected) => {
    let image = document.querySelector(`img[alt="Image ${selected} of 3"]`)
    let viewport = image?.parentElement?.parentElement?.parentElement
    return (
      image instanceof HTMLImageElement &&
      viewport != null &&
      Math.abs(image.getBoundingClientRect().left - viewport.getBoundingClientRect().left) < 1
    )
  }, imageNumber)
  assert.equal(
    await page.getByRole('img', { name: `Image ${imageNumber} of 3` }).getAttribute('loading'),
    'eager',
  )
}
