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
  it('navigates with image dots and keeps their current state in sync with scrolling', async (t) => {
    let page = await t.serve(await createTestServer((await createTestRouter()).fetch))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/albums/overpass-stereo?campaign=dots&image=2#details')
    let dots = page.getByRole('group', { name: 'Choose image', exact: true })
    assert.equal(await dots.getByRole('button').count(), 3)
    let second = dots.getByRole('button', { name: 'Show image 2 of 3' })
    let third = dots.getByRole('button', { name: 'Show image 3 of 3' })
    assert.equal(await second.getAttribute('aria-current'), 'true')
    let entry = await page.locator('script[type="module"][src]').getAttribute('src')
    assert.ok(entry)
    await page.evaluate(async (href) => {
      let { app } = await import(href)
      await app.ready()
    }, entry)
    await third.click()
    await page.waitForURL('**/albums/overpass-stereo?campaign=dots&image=3#details')
    await expectSelectedImage(page, 3)
    assert.equal(await third.getAttribute('aria-current'), 'true')
    assert.equal(await second.getAttribute('aria-current'), null)

    let track = page.getByRole('group', { name: 'Images', exact: true })
    assert.equal(await track.evaluate((node) => getComputedStyle(node).scrollbarWidth), 'none')
    await track.evaluate((node) => node.scrollTo({ left: 0, behavior: 'instant' }))
    await page.waitForURL('**/albums/overpass-stereo?campaign=dots#details')
    assert.equal(
      await dots.getByRole('button', { name: 'Show image 1 of 3' }).getAttribute('aria-current'),
      'true',
    )
    await second.focus()
    await second.press('Space')
    await page.waitForURL('**/albums/overpass-stereo?campaign=dots&image=2#details')
    await expectSelectedImage(page, 2)
    assert.equal(await second.evaluate((node) => node === document.activeElement), true)
  })

  it('supports keyboard controls and native scrolling with reduced motion', async (t) => {
    let page = await t.serve(await createTestServer((await createTestRouter()).fetch))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/albums/overpass-stereo?image=2')
    let carousel = page.getByRole('region', { name: 'Record images' })
    assert.equal(await carousel.count(), 1)
    let track = carousel.getByRole('group', { name: 'Images' })
    await track.and(page.locator('[tabindex="0"]')).waitFor()
    let next = carousel.getByRole('button', { name: 'Next image' })
    let previous = carousel.getByRole('button', { name: 'Previous image' })
    await expectSelectedImage(page, 2)
    assert.equal(await carousel.getByRole('status').textContent(), '')
    await next.focus()
    await next.press('Enter')
    await page.waitForURL('**/albums/overpass-stereo?image=3')
    await expectSelectedImage(page, 3)
    assert.equal(await previous.evaluate((node) => node === document.activeElement), true)
    assert.notEqual(await previous.evaluate((node) => getComputedStyle(node).outlineStyle), 'none')
    assert.equal(await carousel.getByRole('status').textContent(), 'Image 3 of 3')
    await page.setViewportSize({ width: 360, height: 800 })
    await expectSelectedImage(page, 3)

    await track.evaluate((node) => node.scrollTo({ left: 0, behavior: 'instant' }))
    await page.waitForURL('**/albums/overpass-stereo')
    await expectSelectedImage(page, 1)
    assert.equal(await carousel.getByRole('status').textContent(), 'Image 1 of 3')
    await track.focus()
    await track.press('ArrowRight')
    await page.waitForURL('**/albums/overpass-stereo?image=2')
    await expectSelectedImage(page, 2)
  })

  it('handles rapid navigation when scrollend is unavailable', async (t) => {
    let page = await t.serve(await createTestServer((await createTestRouter()).fetch))
    await page.addInitScript(() => {
      Reflect.deleteProperty(Element.prototype, 'onscrollend')
      Reflect.deleteProperty(HTMLElement.prototype, 'onscrollend')
    })
    await page.goto('/albums/overpass-stereo')
    let entry = await page.locator('script[type="module"][src]').getAttribute('src')
    assert.ok(entry)
    await page.evaluate(async (href) => {
      let { app } = await import(href)
      await app.ready()
    }, entry)
    let track = page.getByRole('group', { name: 'Images', exact: true })
    assert.equal(await track.evaluate((node) => 'onscrollend' in node), false)
    let next = page.getByRole('button', { name: 'Next image' })
    await next.click()
    await next.click()
    await page.waitForURL('**/albums/overpass-stereo?image=3')
    await expectSelectedImage(page, 3)
    assert.equal(
      await page.getByRole('region', { name: 'Record images' }).getByRole('status').textContent(),
      'Image 3 of 3',
    )
  })

  it('searches the catalog through a labeled search field', async (t) => {
    let page = await t.serve(await createTestServer((await createTestRouter()).fetch))
    await page.goto('/albums')
    let main = page.getByRole('main')
    let search = main.getByRole('searchbox', { name: 'Search records', exact: true })
    assert.equal(await search.count(), 1)
    await search.fill('Overpass Stereo')
    await main.getByRole('button', { name: 'Search', exact: true }).click()
    await page.waitForURL('**/search?q=Overpass*')
    assert.equal(await page.locator('[data-test-slug="overpass-stereo"]').count(), 1)
    assert.equal(
      await main.getByRole('searchbox', { name: 'Search records', exact: true }).inputValue(),
      'Overpass Stereo',
    )
  })

  it('updates the URL without fetching and preserves selection through reloads and Back', async (t) => {
    let router = await createTestRouter({ albumIds: [1, 2, 3] })
    let requests: URL[] = []
    let pageErrors: string[] = []
    let page = await t.serve(
      await createTestServer((request) => {
        let url = new URL(request.url)
        if (url.pathname === '/albums/overpass-stereo') requests.push(url)
        return router.fetch(request)
      }),
    )
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto('/albums/overpass-stereo?campaign=spring#details')
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
    await page.waitForURL('**/albums/overpass-stereo?campaign=spring&image=2#details')
    await expectSelectedImage(page, 2)
    await next.click()
    await page.waitForURL('**/albums/overpass-stereo?campaign=spring&image=3#details')
    await expectSelectedImage(page, 3)
    assert.equal(await next.isDisabled(), true)
    await previous.click()
    await page.waitForURL('**/albums/overpass-stereo?campaign=spring&image=2#details')
    await previous.click()
    await page.waitForURL('**/albums/overpass-stereo?campaign=spring#details')
    await expectSelectedImage(page, 1)
    assert.equal(await previous.isDisabled(), true)
    assert.equal(requests.length, 1)
    assert.equal(await page.evaluate(() => window.navigation.currentEntry?.index), historyIndex)

    await next.click()
    await page.waitForURL('**/albums/overpass-stereo?campaign=spring&image=2#details')
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
    await page.waitForURL('**/albums/overpass-stereo?campaign=spring&image=2#details')
    await expectSelectedImage(page, 2)
    assert.deepEqual(pageErrors, [])
  })
})
