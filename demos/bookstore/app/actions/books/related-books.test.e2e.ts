import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it } from 'remix/test'

import { createTestRouter } from '../../../test/helpers.ts'

describe('related books', () => {
  it('loads near the viewport with a fallback and keeps the selected carousel image', async (t) => {
    let router = await createTestRouter()
    let requested = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let requests: Request[] = []
    let errors: string[] = []
    let page = await t.serve(
      await createTestServer(async (request) => {
        if (new URL(request.url).pathname === '/books/bbq/related') {
          requests.push(request)
          requested.resolve()
          await release.promise
        }
        return router.fetch(request)
      }),
    )
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width: 1280, height: 250 })
    await page.goto('/books/bbq?image=3')
    let entry = await page.locator('script[type="module"][src]').getAttribute('src')
    assert.ok(entry)
    await page.evaluate(async (href) => {
      let { app } = await import(href)
      await app.ready()
    }, entry)

    let section = page.getByRole('region', { name: 'Related Books', exact: true })
    assert.equal(requests.length, 0)
    assert.equal(await section.locator('[data-test-slug]').count(), 0)
    assert.equal(
      await section.getByRole('link', { name: 'Browse this category' }).getAttribute('href'),
      '/books/genre/cookbook',
    )

    await section.scrollIntoViewIfNeeded()
    await requested.promise
    await section.getByRole('status').getByText('Loading related books…', { exact: true }).waitFor()
    assert.equal(await section.locator('[data-test-slug]').count(), 0)
    assert.equal(requests[0].headers.get('X-Remix-Frame'), 'true')
    assert.equal(requests[0].headers.get('X-Remix-Target'), 'related-books-1')
    release.resolve()
    await section.getByRole('heading', { name: 'Citrus & Salt', exact: true }).waitFor()
    assert.deepEqual(
      await section
        .locator('[data-test-slug]')
        .evaluateAll((cards) => cards.map((card) => card.getAttribute('data-test-slug'))),
      ['bread-before-dawn', 'sunday-noodle-shop', 'citrus-and-salt'],
    )
    assert.equal(requests.length, 1)
    assert.equal(new URL(page.url()).search, '?image=3')
    assert.equal(
      await page.getByRole('img', { name: 'Image 3 of 3' }).getAttribute('loading'),
      'eager',
    )

    let card = section.locator('[data-test-slug="bread-before-dawn"]')
    await card.getByRole('button', { name: 'Add to Cart', exact: true }).click()
    await card.getByRole('button', { name: 'Remove from Cart', exact: true }).waitFor()
    let buttons = await card.locator('.btn').evaluateAll((buttons) =>
      buttons.map((button) => ({
        width: button.getBoundingClientRect().width,
        top: button.getBoundingClientRect().top,
        wraps: button.scrollWidth > button.clientWidth,
        scrollWidth: button.scrollWidth,
        clientWidth: button.clientWidth,
        fontSize: getComputedStyle(button).fontSize,
        text: button.textContent,
      })),
    )
    assert.ok(Math.abs(buttons[0].width - buttons[1].width) < 1)
    assert.ok(Math.abs(buttons[0].top - buttons[1].top) < 1)
    assert.equal(
      buttons.some((button) => button.wraps),
      false,
      `Related book buttons: ${JSON.stringify(buttons)}`,
    )
    assert.equal(new URL(page.url()).search, '?image=3')

    await card.getByRole('link', { name: 'View Details', exact: true }).click()
    await page.getByRole('heading', { level: 1, name: 'Bread Before Dawn', exact: true }).waitFor()
    assert.equal(new URL(page.url()).pathname, '/books/bread-before-dawn')
    assert.deepEqual(errors, [])
  })
})
