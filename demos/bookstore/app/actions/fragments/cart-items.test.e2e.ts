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
    let pageReloads = 0
    let page = await serveCart(t, [{ bookId: '1', slug: 'bbq' }], async (request) => {
      let { pathname } = new URL(request.url)
      if (pathname === routes.cart.index.href() && request.headers.has('X-Remix-Frame')) {
        pageReloads++
      }
      if (pathname !== routes.cart.api.update.href()) return
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
    assert.equal(pageReloads, 0)
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
    await page.getByRole('status').getByText('Updating your cart...').waitFor({ state: 'detached' })
    assert.equal(await page.getByRole('button', { name: 'Remove' }).isDisabled(), false)
    assert.equal(await ashAndSmoke.count(), 0)
  })

  it('keeps optimistic and saved totals consistent for exponent quantities', async (t) => {
    let save = Promise.withResolvers<void>()
    t.after(() => save.resolve())
    let received = Promise.withResolvers<void>()
    let page = await serveCart(t, [{ bookId: '1', slug: 'bbq' }], async (request) => {
      if (new URL(request.url).pathname !== routes.cart.api.update.href()) return
      received.resolve()
      await save.promise
    })

    await page.getByLabel('Quantity of Ash & Smoke').fill('1e2')
    await page.getByRole('button', { name: 'Update' }).click()
    await received.promise
    await page.getByText('Total: $1699.00').waitFor()

    save.resolve()
    await page.getByRole('button', { name: 'Update' }).and(page.locator(':enabled')).waitFor()
    assert.equal(await page.getByText('Total: $1699.00').count(), 1)
  })

  it('puts the cart back and says so when a change fails', async (t) => {
    let page = await serveCart(t, [{ bookId: '1', slug: 'bbq' }], (request) => {
      if (new URL(request.url).pathname === routes.cart.api.remove.href()) {
        return new Response('Server error', { status: 500 })
      }
    })

    await page.getByRole('button', { name: 'Remove' }).click()
    await page
      .getByRole('status')
      .getByText('Couldn’t update your cart. Try again, or reload it to see what’s saved.')
      .waitFor()
    await page.getByRole('row').filter({ hasText: 'Ash & Smoke' }).waitFor()
    await page.getByText('Total: $16.99').waitFor()
  })

  it('reloads the cart in place after a change fails', async (t) => {
    let reloadResponse = Promise.withResolvers<void>()
    t.after(() => reloadResponse.resolve())
    let reloadReceived = Promise.withResolvers<void>()
    let reloads = 0
    let page = await serveCart(t, [{ bookId: '1', slug: 'bbq' }], async (request) => {
      let { pathname } = new URL(request.url)
      if (pathname === routes.cart.api.remove.href()) {
        return new Response('Server error', { status: 500 })
      }
      if (pathname !== routes.cart.index.href() || !request.headers.has('X-Remix-Frame')) return
      reloads++
      reloadReceived.resolve()
      await reloadResponse.promise
    })
    let entries = await page.evaluate(() => history.length)
    await page.getByRole('button', { name: 'Remove' }).click()
    await page
      .getByRole('status')
      .getByText('Couldn’t update your cart.', { exact: false })
      .waitFor()
    // Another tab adds a book, which the cart shows once it reloads.
    await page.request.post(routes.cart.api.add.href(), {
      form: { bookId: '3', slug: 'three-ways' },
      maxRedirects: 0,
    })

    let reload = page.getByRole('link', { name: 'Reload cart' })
    await reload.focus()
    await page.keyboard.press('Enter')
    await reloadReceived.promise
    await page.getByRole('status').getByText('Reloading your cart...').waitFor()
    assert.equal(await reload.getAttribute('aria-disabled'), 'true')
    await page.keyboard.press('Enter')

    reloadResponse.resolve()
    await page.getByRole('row').filter({ hasText: 'Three Ways to Change Your Life' }).waitFor()
    assert.equal(await page.getByRole('status').textContent(), '')
    assert.equal(await reload.count(), 0)
    assert.equal(new URL(page.url()).pathname, routes.cart.index.href())
    assert.equal(await page.evaluate(() => history.length), entries)
    assert.equal(reloads, 1)
  })

  it('says so when reloading the cart fails', async (t) => {
    let page = await serveCart(t, [{ bookId: '1', slug: 'bbq' }], (request) => {
      let { pathname } = new URL(request.url)
      if (
        pathname === routes.cart.api.remove.href() ||
        (pathname === routes.cart.index.href() && request.headers.has('X-Remix-Frame'))
      ) {
        return new Response('Server error', { status: 500 })
      }
    })

    await page.getByRole('button', { name: 'Remove' }).click()
    await page.getByRole('link', { name: 'Reload cart' }).click()
    await page.getByRole('status').getByText('Couldn’t reload your cart. Try again.').waitFor()
    await page.getByRole('row').filter({ hasText: 'Ash & Smoke' }).waitFor()
    assert.equal(new URL(page.url()).pathname, routes.cart.index.href())
  })

  it('keeps keyboard focus and blocks repeated submissions while saving', async (t) => {
    let save = Promise.withResolvers<void>()
    t.after(() => save.resolve())
    let received = Promise.withResolvers<void>()
    let updates = 0
    let page = await serveCart(t, [{ bookId: '1', slug: 'bbq' }], async (request) => {
      if (new URL(request.url).pathname !== routes.cart.api.update.href()) return
      updates++
      received.resolve()
      await save.promise
    })
    let quantity = page.getByLabel('Quantity of Ash & Smoke')

    await quantity.fill('3')
    await quantity.press('Enter')
    await received.promise
    await page.getByText('Total: $50.97').waitFor()
    assert.equal(await quantity.evaluate((input) => input === document.activeElement), true)
    assert.equal(await quantity.isEditable(), false)
    let repeatedSubmitPrevented = await quantity.evaluate((input) => {
      let form = input.closest('form')
      if (!form) throw new Error('Missing quantity form')
      let prevented = false
      form.addEventListener(
        'submit',
        (event) =>
          queueMicrotask(() => {
            prevented = event.defaultPrevented
          }),
        { once: true },
      )
      form.requestSubmit()
      return Promise.resolve().then(() => prevented)
    })
    assert.equal(repeatedSubmitPrevented, true)

    save.resolve()
    await page.getByRole('button', { name: 'Update' }).waitFor()
    assert.equal(await quantity.evaluate((input) => input === document.activeElement), true)
    assert.equal(updates, 1)
  })

  it('restores totals after a failed quantity update and allows a retry', async (t) => {
    let reject = true
    let save = Promise.withResolvers<void>()
    t.after(() => save.resolve())
    let received = Promise.withResolvers<void>()
    let page = await serveCart(t, [{ bookId: '1', slug: 'bbq' }], async (request) => {
      if (new URL(request.url).pathname !== routes.cart.api.update.href()) return
      received.resolve()
      await save.promise
      if (reject) return new Response('Server error', { status: 500 })
    })
    let quantity = page.getByLabel('Quantity of Ash & Smoke')
    let update = page.getByRole('button', { name: 'Update' })

    await quantity.fill('3')
    await update.focus()
    await update.press('Enter')
    await received.promise
    await page.getByRole('button', { name: 'Saving...' }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Saving...' }).isDisabled(), true)
    save.resolve()
    await page
      .getByRole('status')
      .getByText('Couldn’t update your cart. Try again, or reload it to see what’s saved.')
      .waitFor()
    await page.getByText('Total: $16.99').waitFor()
    assert.equal(await quantity.inputValue(), '3')
    assert.equal(await update.evaluate((button) => button === document.activeElement), true)

    reject = false
    await update.press('Enter')
    await page.getByText('Total: $50.97').waitFor()
    await update.waitFor()
    assert.equal(await page.getByRole('status').textContent(), '')
  })

  it('shows the empty cart after removing its last book', async (t) => {
    let save = Promise.withResolvers<void>()
    t.after(() => save.resolve())
    let received = Promise.withResolvers<void>()
    let page = await serveCart(t, [{ bookId: '1', slug: 'bbq' }], async (request) => {
      if (new URL(request.url).pathname !== routes.cart.api.remove.href()) return
      received.resolve()
      await save.promise
    })

    await page.getByRole('button', { name: 'Remove' }).click()
    await received.promise
    await page.getByText('Total: $0.00').waitFor()
    await page.getByRole('status').getByText('Updating your cart...').waitFor()
    assert.equal(await page.getByRole('row').filter({ hasText: 'Ash & Smoke' }).count(), 0)

    save.resolve()
    await page.getByText('Your cart is empty.').waitFor()
    await page.getByRole('link', { name: 'Browse Books' }).waitFor()
    assert.equal(new URL(page.url()).pathname, routes.cart.index.href())
  })

  it('updates and removes items without JavaScript', async (t) => {
    let server = await createTestServer(router.fetch)
    let runtimePage = await t.serve(server)
    let browser = runtimePage.context().browser()
    assert.ok(browser)
    let context = await browser.newContext({ baseURL: server.baseUrl, javaScriptEnabled: false })
    t.after(() => context.close())
    let page = await context.newPage()
    await page.request.post(routes.cart.api.add.href(), {
      form: { bookId: '1' },
      maxRedirects: 0,
    })
    await page.goto(routes.cart.index.href())

    await page.getByLabel('Quantity of Ash & Smoke').fill('3')
    await page.getByRole('button', { name: 'Update' }).click()
    await page.getByText('Total: $50.97').waitFor()
    assert.equal(new URL(page.url()).pathname, routes.cart.index.href())

    await page.getByRole('button', { name: 'Remove' }).click()
    await page.getByText('Your cart is empty.').waitFor()
    assert.equal(new URL(page.url()).pathname, routes.cart.index.href())
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
