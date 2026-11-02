import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { type TestContext, describe, it } from 'remix/test'

import { createTestRouter } from '../../../test/helpers.ts'
import { routes } from '../../routes.ts'

const router = await createTestRouter()

describe('cart items', () => {
  it('shows a new quantity’s totals before the server saves it', async (t) => {
    let save = Promise.withResolvers<void>()
    t.after(() => save.resolve())
    let received = Promise.withResolvers<void>()
    let page = await serveCart(t, [{ bookId: '1', slug: 'bbq' }], async (request) => {
      if (new URL(request.url).pathname !== routes.cart.api.update.href()) return
      received.resolve()
      await save.promise
    })
    let entries = await page.evaluate(() => history.length)

    await page.getByLabel('Quantity of Ash & Smoke').fill('3')
    await page.getByRole('button', { name: 'Update' }).click()
    await received.promise
    await page.getByText('Total: $50.97').waitFor()
    await page.getByRole('button', { name: 'Saving...' }).waitFor()
    await page.getByRole('status').getByText('Updating your cart...').waitFor()

    save.resolve()
    await page.getByRole('button', { name: 'Update' }).waitFor()
    await page.getByText('Total: $50.97').waitFor()
    assert.equal(await page.getByRole('status').textContent(), '')
    assert.equal(new URL(page.url()).pathname, routes.cart.index.href())
    assert.equal(await page.evaluate(() => history.length), entries)
  })

  it('removes a book before the server saves it', async (t) => {
    let save = Promise.withResolvers<void>()
    t.after(() => save.resolve())
    let received = Promise.withResolvers<void>()
    let page = await serveCart(
      t,
      [
        { bookId: '1', slug: 'bbq' },
        { bookId: '3', slug: 'three-ways' },
      ],
      async (request) => {
        if (new URL(request.url).pathname !== routes.cart.api.remove.href()) return
        received.resolve()
        await save.promise
      },
    )
    let ashAndSmoke = page.getByRole('row').filter({ hasText: 'Ash & Smoke' })

    await ashAndSmoke.getByRole('button', { name: 'Remove' }).click()
    await received.promise
    await ashAndSmoke.waitFor({ state: 'detached' })
    await page.getByRole('row').filter({ hasText: 'Three Ways to Change Your Life' }).waitFor()

    save.resolve()
    await page.getByRole('button', { name: 'Remove' }).and(page.locator(':enabled')).waitFor()
    assert.equal(await ashAndSmoke.count(), 0)
  })

  it('puts the cart back and says so when a change fails', async (t) => {
    let page = await serveCart(t, [{ bookId: '1', slug: 'bbq' }], (request) => {
      if (new URL(request.url).pathname === routes.cart.api.remove.href()) {
        return new Response('Server error', { status: 500 })
      }
    })

    await page.getByRole('button', { name: 'Remove' }).click()
    await page.getByRole('status').getByText('Couldn’t update your cart. Try again.').waitFor()
    await page.getByRole('row').filter({ hasText: 'Ash & Smoke' }).waitFor()
    await page.getByText('Total: $16.99').waitFor()
  })
})

/**
 * Serves the bookstore's cart holding `books`. `intercept` sees each request first, and answers it
 * when it returns a response.
 */
async function serveCart(
  t: TestContext,
  books: Array<{ bookId: string; slug: string }>,
  intercept: (request: Request) => Promise<Response | void> | Response | void,
) {
  let page = await t.serve(
    await createTestServer(async (request) => {
      let response = await intercept(request)
      return response ?? router.fetch(request)
    }),
  )
  for (let book of books) {
    await page.request.post(routes.cart.api.add.href(), { form: book, maxRedirects: 0 })
  }
  await page.goto(routes.cart.index.href())
  // The cart's forms hydrate once their module loads, so a click before then would miss the change.
  await page.waitForLoadState('networkidle')
  return page
}
