import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { createTestRouter, expectSelectedImage } from '../../../test/helpers.ts'

// Bound the whole file, including cleanup, without keeping successful workers alive.
setTimeout(() => {
  console.error('image-carousel.test.e2e.ts timed out after 60000ms')
  process.exit(1)
}, 60_000).unref()

describe('album image selection', () => {
  it('updates the URL without fetching and preserves selection through reloads and Back', async (t) => {
    let router = await createTestRouter({ albumIds: [1, 2, 3] })
    let requests: URL[] = []
    let pageErrors: string[] = []
    let page = await t.serve(
      await createTestServer((request) => {
        let url = new URL(request.url)
        if (url.pathname === '/albums/bbq') requests.push(url)
        return router.fetch(request)
      }),
    )
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto('/albums/bbq?campaign=spring#details')
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
    await page.waitForURL('**/albums/bbq?campaign=spring&image=2#details')
    await expectSelectedImage(page, 2)
    await next.click()
    await page.waitForURL('**/albums/bbq?campaign=spring&image=3#details')
    await expectSelectedImage(page, 3)
    assert.equal(await next.isDisabled(), true)
    await previous.click()
    await page.waitForURL('**/albums/bbq?campaign=spring&image=2#details')
    await previous.click()
    await page.waitForURL('**/albums/bbq?campaign=spring#details')
    await expectSelectedImage(page, 1)
    assert.equal(await previous.isDisabled(), true)
    assert.equal(requests.length, 1)
    assert.equal(await page.evaluate(() => window.navigation.currentEntry?.index), historyIndex)

    await next.click()
    await page.waitForURL('**/albums/bbq?campaign=spring&image=2#details')
    await page.evaluate(async (href) => {
      let { app } = await import(href)
      await app.frames.top.reload()
    }, entry)
    await expectSelectedImage(page, 2)
    assert.equal(requests.at(-1)?.searchParams.get('image'), '2')
    await page.reload()
    await expectSelectedImage(page, 2)
    await page.getByRole('link', { name: 'Back to Records' }).click()
    await page.getByRole('heading', { name: 'Browse Records', exact: true }).waitFor()
    await page.goBack()
    await page.waitForURL('**/albums/bbq?campaign=spring&image=2#details')
    await expectSelectedImage(page, 2)
    assert.deepEqual(pageErrors, [])
  })
})
