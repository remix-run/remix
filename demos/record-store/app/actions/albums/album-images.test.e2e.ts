import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { createTestRouter, expectSelectedImage } from '../../../test/helpers.ts'

describe('album images', () => {
  it('server renders and preloads the requested image with a safe default for invalid values', async (t) => {
    let server = await createTestServer((await createTestRouter()).fetch)
    let runtimePage = await t.serve(server)
    let browser = runtimePage.context().browser()
    assert.ok(browser)
    let context = await browser.newContext({ baseURL: server.baseUrl, javaScriptEnabled: false })
    try {
      let page = await context.newPage()
      await page.goto('/albums/overpass-stereo?image=3')
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

      await page.goto('/albums/overpass-stereo?image=99')
      await expectSelectedImage(page, 1)
      assert.equal(await page.getByRole('button', { name: 'Previous image' }).isDisabled(), true)
      await page.goto('/albums/overpass-stereo?image=2.5')
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
      await page.waitForFunction(() => {
        let image = document.querySelector('[data-test-slug] img')
        return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
      })
      assert.equal(
        await cover.evaluate((image: HTMLImageElement) => new URL(image.currentSrc).search),
        '?transform=album-image-768',
      )
      let coverSrc = await cover.evaluate((image: HTMLImageElement) => {
        let url = new URL(image.currentSrc)
        return url.pathname + url.search
      })
      assert.deepEqual(
        requests.filter((url) => url.includes('/overpass-stereo-1.')),
        [coverSrc],
      )
      requests = []
      await page.goto('/albums/overpass-stereo?image=3')
      let selected = page.getByRole('img', { name: 'Image 3 of 3' })
      await expectSelectedImage(page, 3)
      let currentSrc = await selected.evaluate((image: HTMLImageElement) => {
        let url = new URL(image.currentSrc)
        return url.pathname + url.search
      })
      assert.equal(new URL(currentSrc, server.baseUrl).search, '?transform=album-image-640')
      assert.deepEqual(
        requests.filter((url) => url.includes('/overpass-stereo-3.')),
        [currentSrc],
      )
      let faceout = await selected.boundingBox()
      assert.ok(faceout)
      assert.expect(faceout.width).toBeCloseTo(300)
      assert.expect(faceout.height).toBeCloseTo(300)
    } finally {
      await context.close()
    }
  })
})
