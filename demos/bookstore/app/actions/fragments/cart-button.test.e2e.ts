import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { type TestContext, describe, it } from 'remix/test'

import { createTestRouter } from '../../../test/helpers.ts'
import { routes } from '../../routes.ts'

const router = await createTestRouter()

describe('cart button', () => {
  it('saves a book to the cart without leaving the page', async (t) => {
    let save = Promise.withResolvers<void>()
    t.after(() => save.resolve())
    let received = Promise.withResolvers<void>()
    let pageReloads = 0
    let page = await serveBooks(t, async (request) => {
      let { pathname } = new URL(request.url)
      if (pathname === routes.books.index.href() && request.headers.has('X-Remix-Frame')) {
        pageReloads++
      }
      if (pathname !== routes.api.cartToggle.href()) return
      received.resolve()
      await save.promise
    })
    let card = page.locator('.book-card').last()
    await card.scrollIntoViewIfNeeded()
    let scrollY = await page.evaluate(() => window.scrollY)
    let entries = await page.evaluate(() => history.length)

    await card.getByRole('button', { name: 'Add to Cart' }).focus()
    await page.keyboard.press('Enter')
    await received.promise
    await card.getByRole('button', { name: 'Saving...' }).waitFor()

    save.resolve()
    let button = card.getByRole('button', { name: 'Remove from Cart' })
    await button.waitFor()
    assert.equal(await button.evaluate((element) => element === document.activeElement), true)
    assert.equal(new URL(page.url()).pathname, routes.books.index.href())
    assert.equal(await page.evaluate(() => history.length), entries)
    assert.equal(await page.evaluate(() => window.scrollY), scrollY)
    assert.equal(pageReloads, 0)
  })

  it('shows the book’s place in the cart again when a save fails', async (t) => {
    let page = await serveBooks(t, (request) => {
      if (new URL(request.url).pathname === routes.api.cartToggle.href()) {
        return new Response('Server error', { status: 500 })
      }
    })
    let card = page.locator('.book-card').first()

    await card.getByRole('button', { name: 'Add to Cart' }).click()
    await card.getByRole('button', { name: 'Add to Cart' }).waitFor()
    assert.equal(new URL(page.url()).pathname, routes.books.index.href())
  })
})

/**
 * Serves the bookstore's book list. `intercept` sees each request first, and answers it when it
 * returns a response.
 */
async function serveBooks(
  t: TestContext,
  intercept: (request: Request) => Promise<Response | void> | Response | void,
) {
  let page = await t.serve(
    await createTestServer(async (request) => {
      let response = await intercept(request)
      return response ?? router.fetch(request)
    }),
  )
  await page.goto(routes.books.index.href())
  // The buttons' forms hydrate once their module loads, so a click before then would miss the save.
  await page.waitForLoadState('networkidle')
  return page
}
