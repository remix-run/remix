import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { type TestContext, describe, it } from 'remix/test'
import type { Page, Request } from 'playwright'

import { createTestRouter } from '../../../test/helpers.ts'
import { routes } from '../../routes.ts'

const router = await createTestRouter()

describe('cart changes', () => {
  it('shows an added book at once and keeps it once the server saves it', async (t) => {
    let { page, nextUpdate } = await serveBookstore(t)
    await openPage(page, routes.books.show.href({ slug: 'bbq' }))

    await page.getByRole('button', { name: 'Add to Cart' }).click()
    let update = await nextUpdate()
    assert.equal(update.quantity, '1')
    await page.getByRole('button', { name: 'Remove from Cart' }).waitFor()

    let reloaded = waitForFragment(page, routes.fragments.cartButton.href({ bookId: 1 }))
    update.respond()
    await reloaded
    await page.getByRole('button', { name: 'Remove from Cart' }).waitFor()

    await page.goto(routes.cart.index.href())
    await page.getByRole('link', { name: 'Ash & Smoke', exact: true }).waitFor()
  })

  it('retries a change the server is too busy to take', async (t) => {
    let { page, nextUpdate } = await serveBookstore(t)
    await openPage(page, routes.books.show.href({ slug: 'bbq' }))

    await page.getByRole('button', { name: 'Add to Cart' }).click()
    ;(await nextUpdate()).respond(
      new Response(null, { status: 503, headers: { 'Retry-After': '0' } }),
    )
    let retry = await nextUpdate()
    assert.equal(retry.quantity, '1')
    await page.getByText('Retrying…').waitFor()
    await page.getByRole('button', { name: 'Remove from Cart' }).waitFor()

    retry.respond()
    await page.getByText('Retrying…').waitFor({ state: 'detached' })
    await page.getByRole('button', { name: 'Remove from Cart' }).waitFor()
  })

  it('reverts a change the server refuses and saves it when the visitor tries again', async (t) => {
    let { page, nextUpdate } = await serveBookstore(t)
    await openPage(page, routes.books.show.href({ slug: 'bbq' }))

    await page.getByRole('button', { name: 'Add to Cart' }).click()
    ;(await nextUpdate()).respond(new Response(null, { status: 500 }))
    await page.getByRole('button', { name: 'Add to Cart' }).waitFor()
    await page.getByRole('status').getByText('Couldn’t add Ash & Smoke to your cart.').waitFor()

    await page.getByRole('button', { name: 'Try again' }).click()
    let retry = await nextUpdate()
    assert.equal(retry.quantity, '1')
    await page.getByRole('button', { name: 'Remove from Cart' }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Try again' }).count(), 0)

    let reloaded = waitForFragment(page, routes.fragments.cartButton.href({ bookId: 1 }))
    retry.respond()
    await reloaded
    await page.goto(routes.cart.index.href())
    await page.getByRole('link', { name: 'Ash & Smoke', exact: true }).waitFor()
  })

  it('sends the latest choice once the change on its way is answered', async (t) => {
    let { page, nextUpdate, received } = await serveBookstore(t)
    await openPage(page, routes.books.show.href({ slug: 'bbq' }))

    await page.getByRole('button', { name: 'Add to Cart' }).click()
    let first = await nextUpdate()
    await page.getByRole('button', { name: 'Remove from Cart' }).click()
    await page.getByRole('button', { name: 'Add to Cart' }).click()
    await page.getByRole('button', { name: 'Remove from Cart' }).waitFor()

    // Sent together, the removal could save its session after the add and lose it.
    first.respond()
    let latest = await nextUpdate()
    assert.equal(latest.quantity, '1')
    let reloaded = waitForFragment(page, routes.fragments.cartButton.href({ bookId: 1 }))
    latest.respond()
    await reloaded
    assert.equal(received(), 2)

    await page.goto(routes.cart.index.href())
    assert.equal(
      await page.getByRole('spinbutton', { name: 'Quantity of Ash & Smoke' }).inputValue(),
      '1',
    )
  })

  it('shows a change still on its way on the next page', async (t) => {
    let { page, nextUpdate } = await serveBookstore(t)
    await openPage(page, routes.books.show.href({ slug: 'bbq' }))

    await page.getByRole('button', { name: 'Add to Cart' }).click()
    let update = await nextUpdate()
    await page.getByRole('banner').getByRole('link', { name: 'Cart', exact: true }).click()
    await page.getByRole('heading', { name: 'Shopping Cart' }).waitFor()
    await page.getByRole('link', { name: 'Ash & Smoke', exact: true }).waitFor()
    await page.getByText('Total: $16.99').waitFor()

    let reloaded = waitForFragment(page, routes.fragments.cartItems.href())
    update.respond()
    await reloaded
    await page.getByText('Total: $16.99').waitFor()
  })

  it('sends a change again after a reload interrupts it', async (t) => {
    let { page, nextUpdate } = await serveBookstore(t)
    let errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(error.message))
    await openPage(page, routes.books.show.href({ slug: 'bbq' }))

    await page.getByRole('button', { name: 'Add to Cart' }).click()
    // Left unanswered, as if the reload cut it off.
    await nextUpdate()
    await page.reload()

    let resent = await nextUpdate()
    assert.equal(resent.quantity, '1')
    // The server's page still has the book out of the cart; the stored change applies on top.
    await page.getByRole('button', { name: 'Remove from Cart' }).waitFor()
    let reloaded = waitForFragment(page, routes.fragments.cartButton.href({ bookId: 1 }))
    resent.respond()
    await reloaded
    await page.getByRole('button', { name: 'Remove from Cart' }).waitFor()
    assert.deepEqual(errors, [])
  })

  it('shows a change saved after the next document was rendered', async (t) => {
    let { page, nextUpdate, holdResponse, passUpdates } = await serveBookstore(t)
    await openPage(page, routes.books.show.href({ slug: 'bbq' }))

    await page.getByRole('button', { name: 'Add to Cart' }).click()
    let update = await nextUpdate()
    // Chromium and Firefox give the old page the save's answer. WebKit cancels it as the
    // navigation starts, so the next page sends the change again, and the server answers that.
    passUpdates()
    let settled = Promise.withResolvers<void>()
    let isUpdate = (request: Request) =>
      new URL(request.url()).pathname === routes.cart.api.update.href()
    page.on('response', (response) => isUpdate(response.request()) && settled.resolve())
    page.on('requestfailed', (request) => isUpdate(request) && settled.resolve())
    let cart = holdResponse(routes.cart.index.href())
    let navigation = started(page.goto(routes.cart.index.href()))
    await cart.rendered
    update.respond()
    await settled.promise

    // The server has saved the change, but the next page's HTML still has an empty cart.
    let reloaded = waitForFragment(page, routes.fragments.cartItems.href())
    cart.release()
    await navigation
    await page.getByRole('link', { name: 'Ash & Smoke', exact: true }).waitFor()
    await reloaded
    await page.getByRole('link', { name: 'Ash & Smoke', exact: true }).waitFor()
  })

  it('updates and removes cart items at once', async (t) => {
    let { page, nextUpdate } = await serveBookstore(t)
    await page.request.post(routes.cart.api.update.href(), {
      form: { _method: 'PUT', bookId: '1', quantity: '2', redirect: 'none' },
    })
    await openPage(page, routes.cart.index.href())
    await page.getByText('Total: $33.98').waitFor()

    await page.getByRole('spinbutton', { name: 'Quantity of Ash & Smoke' }).fill('3')
    await page.getByRole('button', { name: 'Update', exact: true }).click()
    let update = await nextUpdate()
    assert.equal(update.quantity, '3')
    await page.getByText('Total: $50.97').waitFor()

    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    await page.getByText('Your cart is empty.').waitFor()
    update.respond()
    let removal = await nextUpdate()
    assert.equal(removal.quantity, '0')
    let reloaded = waitForFragment(page, routes.fragments.cartItems.href())
    removal.respond()
    await reloaded
    await page.getByText('Your cart is empty.').waitFor()

    await page.goto(routes.cart.index.href())
    await page.getByText('Your cart is empty.').waitFor()
  })

  it('keeps focus in a quantity field that updates the cart from the keyboard', async (t) => {
    let { page, nextUpdate } = await serveBookstore(t)
    await page.request.post(routes.cart.api.update.href(), {
      form: { _method: 'PUT', bookId: '1', quantity: '2', redirect: 'none' },
    })
    await openPage(page, routes.cart.index.href())
    let field = page.getByRole('spinbutton', { name: 'Quantity of Ash & Smoke' })

    await field.fill('3')
    await field.press('Enter')
    let update = await nextUpdate()
    assert.equal(update.quantity, '3')
    await page.getByText('Total: $50.97').waitFor()
    assert.equal(await field.evaluate((input) => input === document.activeElement), true)
    update.respond()
  })

  it('shows the cart’s quantity again in a field whose update the server refuses', async (t) => {
    let { page, nextUpdate } = await serveBookstore(t)
    await page.request.post(routes.cart.api.update.href(), {
      form: { _method: 'PUT', bookId: '1', quantity: '2', redirect: 'none' },
    })
    await openPage(page, routes.cart.index.href())
    let field = page.getByRole('spinbutton', { name: 'Quantity of Ash & Smoke' })

    await field.fill('3')
    await field.press('Enter')
    let update = await nextUpdate()
    update.respond(new Response('Server error', { status: 500 }))
    await page.getByText('Couldn’t update Ash & Smoke in your cart.').waitFor()
    await page.getByText('Total: $33.98').waitFor()
    assert.equal(await field.inputValue(), '2')
  })
})

type CartUpdate = {
  quantity: string | null
  /** Answers the request, with the app's own response unless given one. */
  respond(response?: Response): void
}

// Holds each cart update the islands send until the test answers it, and any response the test
// asks to hold.
async function serveBookstore(t: TestContext) {
  let updates: CartUpdate[] = []
  let waiting: ((update: CartUpdate) => void) | undefined
  let unanswered = new Set<() => void>()
  let heldResponses = new Map<string, { rendered(): void; released: Promise<void> }>()
  let count = 0
  let passing = false
  t.after(() => {
    for (let release of unanswered) release()
  })

  let page = await t.serve(
    await createTestServer(async (request) => {
      let { pathname } = new URL(request.url)
      let held = heldResponses.get(pathname)
      if (held) {
        heldResponses.delete(pathname)
        let response = await router.fetch(request)
        held.rendered()
        await held.released
        return response
      }

      if (request.method !== 'PUT' || pathname !== routes.cart.api.update.href()) {
        return router.fetch(request)
      }

      count++
      if (passing) return router.fetch(request)
      let answer = Promise.withResolvers<Response | undefined>()
      let release = () => answer.resolve(new Response(null, { status: 503 }))
      unanswered.add(release)
      let update: CartUpdate = {
        quantity: (await request.clone().formData()).get('quantity') as string | null,
        respond(response) {
          unanswered.delete(release)
          answer.resolve(response)
        },
      }
      if (waiting) waiting(update)
      else updates.push(update)
      waiting = undefined
      return (await answer.promise) ?? router.fetch(request)
    }),
  )

  return {
    page,
    /** The next cart update the server receives. */
    nextUpdate(): Promise<CartUpdate> {
      let update = updates.shift()
      if (update) return Promise.resolve(update)
      return new Promise((resolve) => (waiting = resolve))
    },
    /** How many cart updates the server has received. */
    received: () => count,
    /** Has the server answer cart updates from now on, as the app would. */
    passUpdates() {
      passing = true
      for (let update of updates.splice(0)) update.respond()
    },
    /** Renders the next request for a path at once, and holds its response until released. */
    holdResponse(pathname: string) {
      let rendered = Promise.withResolvers<void>()
      let released = Promise.withResolvers<void>()
      t.after(() => released.resolve())
      heldResponses.set(pathname, { rendered: rendered.resolve, released: released.promise })
      return { rendered: rendered.promise, release: released.resolve }
    },
  }
}

// Islands hydrate once their modules load, so a click before then would post the form without
// them.
async function openPage(page: Page, href: string): Promise<void> {
  await page.goto(href)
  await page.waitForLoadState('networkidle')
}

// Playwright's `response.finished()` never settles for frame fetches, so this waits for the answer
// and leaves its rendering to the assertions after it.
function waitForFragment(page: Page, href: string): Promise<unknown> {
  return started(page.waitForResponse((response) => new URL(response.url()).pathname === href))
}

// For a promise a test awaits later: if the test fails first, it reports that failure rather than
// crashing its worker when the promise rejects.
function started<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => {})
  return promise
}
