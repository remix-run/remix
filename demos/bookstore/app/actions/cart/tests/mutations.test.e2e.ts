import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it, type TestContext } from 'remix/test'
import type { Page } from 'playwright'

import { createTestRouter } from '../../../../test/helpers.ts'

describe('cart submissions', () => {
  it('toggles in one frame submission and recovers a lost response with a page reload', async (t) => {
    let received = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let requests: string[] = []
    let rejecting = false
    let page = await serveCart(
      t,
      async (request, respond) => {
        let pathname = new URL(request.url).pathname
        if (pathname !== '/fragments/cart-button/1') return
        requests.push(`${request.method} ${pathname}`)
        if (request.method !== 'POST') return
        assert.equal(request.headers.get('X-Remix-Frame'), 'true')
        received.resolve()
        await release.promise
        if (rejecting) {
          await (await respond()).text()
          return new Response('Unavailable', { status: 503 })
        }
      },
      [],
      '/books/bbq',
    )
    requests.length = 0
    let initial = await frameState(page)
    await page.getByRole('button', { name: 'Add to Cart', exact: true }).click()
    await received.promise
    let pending = page.getByRole('button', { name: 'Saving...', exact: true })
    await pending.waitFor()
    assert.equal(await pending.getAttribute('aria-disabled'), 'true')
    await pending.evaluate((button: HTMLButtonElement) => button.form?.requestSubmit(button))
    release.resolve()
    let remove = page.getByRole('button', { name: 'Remove from Cart', exact: true })
    await remove.waitFor()
    assert.equal(await remove.evaluate((button) => button === document.activeElement), true)
    await remove.press('Enter')
    await page.getByRole('button', { name: 'Add to Cart', exact: true }).waitFor()
    rejecting = true
    await page.getByRole('button', { name: 'Add to Cart', exact: true }).click()
    let failed = page.getByRole('button', { name: 'Failed!', exact: true })
    await failed.waitFor()
    assert.notEqual(
      await failed.evaluate((button) => getComputedStyle(button).animationName),
      'none',
    )
    assert.equal(await page.getByRole('alert').count(), 0)
    assert.deepEqual(requests, [
      'POST /fragments/cart-button/1',
      'POST /fragments/cart-button/1',
      'POST /fragments/cart-button/1',
    ])
    await page.reload()
    await remove.waitFor()
    assert.equal(await page.getByRole('alert').count(), 0)
    assert.deepEqual(
      requests.filter((request) => request.startsWith('POST')),
      [
        'POST /fragments/cart-button/1',
        'POST /fragments/cart-button/1',
        'POST /fragments/cart-button/1',
      ],
    )
    assert.deepEqual(await frameState(page), initial)
    await page.goto('/cart')
    await page.getByRole('row').filter({ hasText: 'Ash & Smoke' }).waitFor()
  })

  it('redirects native toggles to the initiating page and flashes errors on the matching book once', async (t) => {
    let rejecting = false
    t.mock.method(Math, 'random', () => (rejecting ? 0 : 1))
    let router = await createTestRouter()
    let server = await createTestServer((request) => router.fetch(request))
    let runtimePage = await t.serve(server)
    let browser = runtimePage.context().browser()
    assert.ok(browser)
    let context = await browser.newContext({ baseURL: server.baseUrl, javaScriptEnabled: false })
    t.after(() => context.close())
    let page = await context.newPage()
    await page.goto('/books/bbq?from=catalog')
    await page.getByRole('button', { name: 'Add to Cart', exact: true }).click()
    await page.getByRole('button', { name: 'Remove from Cart', exact: true }).waitFor()
    assert.equal(
      new URL(page.url()).pathname + new URL(page.url()).search,
      '/books/bbq?from=catalog',
    )
    await page.getByRole('button', { name: 'Remove from Cart', exact: true }).click()
    await page.getByRole('button', { name: 'Add to Cart', exact: true }).waitFor()
    assert.equal(
      new URL(page.url()).pathname + new URL(page.url()).search,
      '/books/bbq?from=catalog',
    )

    await page.goto('/books?from=native')
    let card = page.locator('[data-test-slug="three-ways"]')
    rejecting = true
    await card.getByRole('button', { name: 'Add to Cart', exact: true }).click()
    await card.getByRole('alert').getByText('Couldn’t update this book. Try again.').waitFor()
    let details = await card.getByRole('link', { name: 'View Details' }).boundingBox()
    let button = await card.getByRole('button', { name: 'Add to Cart', exact: true }).boundingBox()
    let row = await card.getByRole('link', { name: 'View Details' }).locator('..').boundingBox()
    let error = await card.getByRole('alert').boundingBox()
    assert.ok(details && button && row && error)
    assert.equal(error.x, row.x)
    assert.equal(error.width, row.width)
    assert.ok(error.y >= Math.max(details.y + details.height, button.y + button.height))
    assert.equal(new URL(page.url()).pathname + new URL(page.url()).search, '/books?from=native')
    assert.equal(await page.getByRole('alert').count(), 1)
    await card.getByRole('button', { name: 'Add to Cart', exact: true }).waitFor()
    await page.reload()
    assert.equal(await page.getByRole('alert').count(), 0)

    rejecting = false
    await card.getByRole('button', { name: 'Add to Cart', exact: true }).click()
    await card.getByRole('button', { name: 'Remove from Cart', exact: true }).waitFor()
    rejecting = true
    await card.getByRole('button', { name: 'Remove from Cart', exact: true }).click()
    await card.getByRole('alert').getByText('Couldn’t update this book. Try again.').waitFor()
    await card.getByRole('button', { name: 'Remove from Cart', exact: true }).waitFor()
    assert.equal(new URL(page.url()).pathname + new URL(page.url()).search, '/books?from=native')
    await page.reload()
    assert.equal(await page.getByRole('alert').count(), 0)
  })

  it('posts once to the frame source with pending prices and stable focus', async (t) => {
    let received = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let requests: string[] = []
    let page = await serveCart(t, async (request) => {
      let pathname = new URL(request.url).pathname
      if (!pathname.startsWith('/cart/items')) return
      requests.push(`${request.method} ${pathname}`)
      if (request.method !== 'POST') return
      received.resolve()
      await release.promise
    })
    requests.length = 0
    let quantity = page.getByRole('spinbutton', { name: 'Quantity of Ash & Smoke' })
    let initial = await frameState(page)
    await quantity.fill('3')
    await quantity.press('Enter')
    await received.promise
    await page.getByRole('button', { name: 'Saving...' }).waitFor()
    await page.locator('[aria-busy="true"]').filter({ hasText: 'Total: $16.99' }).waitFor()
    let row = page.getByRole('row').filter({ hasText: 'Ash & Smoke' })
    let subtotal = row.getByRole('cell').nth(3)
    assert.equal(await subtotal.textContent(), '$16.99')
    await subtotal.locator('[aria-busy="true"]').waitFor()
    let appearance = await subtotal.evaluate((cell) => {
      let amount = cell.querySelector('[aria-busy] > span')
      let spinner = cell.querySelector('[aria-hidden="true"]')
      if (!amount || !spinner) throw new Error('Missing pending price')
      for (let animation of amount.getAnimations()) animation.finish()
      return {
        opacity: getComputedStyle(amount).opacity,
        spinner: getComputedStyle(spinner).visibility,
        animation: getComputedStyle(spinner).animationName,
      }
    })
    assert.equal(appearance.opacity, '0.3')
    assert.equal(appearance.spinner, 'visible')
    assert.notEqual(appearance.animation, 'none')
    assert.equal(await quantity.getAttribute('readonly'), '')
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute('name')),
      'quantity',
    )
    assert.deepEqual(await frameState(page), initial)

    // A second submission while saving must not start another session write.
    await page
      .locator('form[action="/cart/items"]:has(input[name="quantity"])')
      .evaluate((form: HTMLFormElement) => form.requestSubmit())
    release.resolve()
    await page.getByRole('button', { name: 'Update', exact: true }).waitFor()
    await page.getByText('Total: $50.97', { exact: true }).waitFor()
    assert.equal(await row.getByRole('cell').nth(3).textContent(), '$50.97')
    assert.equal(await page.locator('[aria-busy="true"]').count(), 0)
    assert.deepEqual(requests, ['POST /cart/items'])
    assert.deepEqual(await frameState(page), initial)
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute('name')),
      'quantity',
    )
    await page.reload()
    await page.getByText('Total: $50.97', { exact: true }).waitFor()
  })

  it('keeps client and server validation scoped to the submitted cart form', async (t) => {
    let mutations = 0
    let page = await serveCart(
      t,
      (request) => {
        if (request.method === 'POST') mutations++
      },
      ['1', '2'],
    )
    let first = page.getByRole('spinbutton', { name: 'Quantity of Ash & Smoke' })
    let second = page.getByRole('spinbutton', { name: 'Quantity of Heavy Metal Guitar Riffs' })
    assert.equal(await first.getAttribute('min'), '1')
    assert.equal(await first.getAttribute('max'), String(Number.MAX_SAFE_INTEGER))
    assert.equal(await first.getAttribute('step'), '1')
    assert.equal(await first.getAttribute('required'), '')
    assert.notEqual(await first.getAttribute('id'), await second.getAttribute('id'))
    await first.fill('0')
    await first.blur()
    await page.waitForFunction(() => {
      let input = document.querySelector('input[aria-label="Quantity of Ash & Smoke"]')
      return input?.getAttribute('aria-invalid') === 'true'
    })
    let row = page.getByRole('row').filter({ hasText: 'Ash & Smoke' })
    await row.getByRole('alert').filter({ hasText: 'Invalid quantity' }).waitFor()
    await row.getByRole('button', { name: 'Update', exact: true }).click()
    assert.equal(mutations, 0)

    await second.fill('2')
    await second.press('Enter')
    await page.getByText('Total: $70.99', { exact: true }).waitFor()
    assert.equal(mutations, 1)

    await first.fill('1.5')
    let rejected = page.waitForResponse((response) => response.request().method() === 'POST')
    let nativeForm = page.locator('form:has(input[aria-label="Quantity of Ash & Smoke"])')
    await nativeForm.evaluate((form: HTMLFormElement) => {
      form.noValidate = true
      form.requestSubmit()
    })
    assert.equal((await rejected).status(), 400)
    await nativeForm.locator('input[name="quantity"][readonly]').waitFor({ state: 'detached' })
    assert.equal(await first.inputValue(), '1.5')
    assert.equal(await first.getAttribute('aria-invalid'), 'true')
    let errorId = await first.getAttribute('aria-describedby')
    assert.ok(errorId)
    let error = page.locator(`[id="${errorId}"][role="alert"]`)
    await error.waitFor()
    assert.equal(await error.textContent(), 'Invalid quantity')
    await row.getByRole('button', { name: 'Failed!', exact: true }).waitFor()
    assert.equal(await second.inputValue(), '2')
    assert.equal(await second.getAttribute('aria-invalid'), null)

    await nativeForm.evaluate((form: HTMLFormElement) => {
      form.noValidate = false
    })
    await first.fill('3')
    await first.press('Enter')
    await page.getByText('Total: $104.97', { exact: true }).waitFor()
    assert.equal(await first.getAttribute('aria-invalid'), null)
    await error.waitFor({ state: 'detached' })
    assert.equal(mutations, 3)
  })

  it('rolls back a failed update and allows a direct retry', async (t) => {
    let reject = true
    let mutations = 0
    let page = await serveCart(t, (request) => {
      if (new URL(request.url).pathname !== '/cart/items' || request.method !== 'POST') return
      mutations++
      if (reject) {
        return new Response('Unavailable', { status: 503 })
      }
    })
    let quantity = page.getByRole('spinbutton', { name: 'Quantity of Ash & Smoke' })
    let row = page.getByRole('row').filter({ hasText: 'Ash & Smoke' })
    let initialRow = await row.boundingBox()
    let total = page.getByText('Total: $16.99', { exact: true })
    let initialTotal = await total.boundingBox()
    await quantity.fill('4')
    await quantity.press('Enter')
    await row.getByRole('button', { name: 'Failed!', exact: true }).waitFor()
    assert.equal(await page.getByRole('alert').count(), 0)
    await page.getByText('Total: $16.99', { exact: true }).waitFor()
    assert.deepEqual(await row.boundingBox(), initialRow)
    assert.deepEqual(await total.boundingBox(), initialTotal)
    assert.equal(await quantity.inputValue(), '1')
    assert.equal(await quantity.getAttribute('readonly'), null)
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute('name')),
      'quantity',
    )
    reject = false
    await quantity.fill('4')
    await quantity.press('Enter')
    await page.getByRole('button', { name: 'Update', exact: true }).waitFor()
    await page.getByText('Total: $67.96', { exact: true }).waitFor()
    assert.equal(mutations, 2)
  })

  it('recovers the saved quantity with a page reload when the mutation response is lost', async (t) => {
    let mutations = 0
    let methods: string[] = []
    let page = await serveCart(t, async (request, respond) => {
      if (new URL(request.url).pathname !== '/cart/items') return
      methods.push(request.method)
      if (request.method === 'POST') {
        mutations++
        await (await respond()).text()
        return new Response('Unavailable', { status: 503 })
      }
    })
    methods.length = 0
    let quantity = page.getByRole('spinbutton', { name: 'Quantity of Ash & Smoke' })
    await quantity.fill('3')
    await quantity.press('Enter')
    await page.getByRole('button', { name: 'Failed!', exact: true }).waitFor()
    assert.equal(await page.getByRole('alert').count(), 0)
    await page.getByText('Total: $16.99', { exact: true }).waitFor()
    assert.equal(await quantity.inputValue(), '1')
    assert.deepEqual(methods, ['POST'])
    await page.reload()
    assert.equal(await page.getByRole('alert').count(), 0)
    await page.getByText('Total: $50.97', { exact: true }).waitFor()
    assert.equal(mutations, 1)
  })

  it('keeps the row pending until one DELETE override confirms removal', async (t) => {
    let received = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let requests: string[] = []
    let page = await serveCart(
      t,
      async (request) => {
        if (!new URL(request.url).pathname.startsWith('/cart/items')) return
        requests.push(
          request.method === 'POST'
            ? `POST ${(await request.clone().formData()).get('_method')}`
            : request.method,
        )
        if (request.method === 'POST') {
          received.resolve()
          await release.promise
        }
      },
      ['1', '2'],
    )
    let initial = await frameState(page)
    requests.length = 0
    let row = page.getByRole('row').filter({ hasText: 'Ash & Smoke' })
    await row.getByRole('button', { name: 'Remove', exact: true }).press('Enter')
    await received.promise
    let removing = row.getByRole('button', { name: 'Removing...', exact: true })
    await removing.waitFor()
    await page.locator('[aria-busy="true"]').filter({ hasText: 'Total: $43.99' }).waitFor()
    assert.equal(await removing.getAttribute('aria-disabled'), 'true')
    assert.equal(await removing.evaluate((button) => button === document.activeElement), true)
    assert.deepEqual(await frameState(page), initial)
    await row
      .locator('form:has(input[name="_method"])')
      .evaluate((form: HTMLFormElement) => form.requestSubmit())
    release.resolve()
    await row.waitFor({ state: 'detached' })
    await page.getByRole('button', { name: 'Remove', exact: true }).waitFor()
    assert.deepEqual(requests, ['POST DELETE'])
    assert.deepEqual(await frameState(page), initial)
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
      'Shopping cart',
    )
    await page.reload()
    assert.equal(await row.count(), 0)
    await page.getByText('Total: $27.00', { exact: true }).waitFor()
  })

  it('keeps the last item pending before rendering the server empty state', async (t) => {
    let received = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let page = await serveCart(t, async (request) => {
      if (request.method === 'POST') {
        received.resolve()
        await release.promise
      }
    })
    await page.getByRole('button', { name: 'Remove', exact: true }).press('Enter')
    await received.promise
    let removing = page.getByRole('button', { name: 'Removing...', exact: true })
    await removing.waitFor()
    assert.equal(await page.getByText('Your cart is empty.', { exact: true }).count(), 0)
    await page.locator('[aria-busy="true"]').filter({ hasText: 'Total: $16.99' }).waitFor()
    assert.equal(await removing.evaluate((button) => button === document.activeElement), true)
    release.resolve()
    await page.getByRole('link', { name: 'Browse Books', exact: true }).waitFor()
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
      'Shopping cart',
    )
  })

  it('keeps a failed removal available and reconciles a lost response with a page reload', async (t) => {
    let mutations = 0
    let methods: string[] = []
    let page = await serveCart(t, async (request, respond) => {
      if (!new URL(request.url).pathname.startsWith('/cart/items')) return
      methods.push(request.method)
      if (request.method !== 'POST') return
      mutations++
      if (mutations === 2) await (await respond()).text()
      return new Response('Unavailable', { status: 503 })
    })
    let row = page.getByRole('row').filter({ hasText: 'Ash & Smoke' })
    let initialRow = await row.boundingBox()
    let remove = row.getByRole('button', { name: 'Remove', exact: true })
    await remove.press('Enter')
    let failed = row.getByRole('button', { name: 'Failed!', exact: true })
    await failed.waitFor()
    assert.equal(await page.getByRole('alert').count(), 0)
    assert.deepEqual(await row.boundingBox(), initialRow)
    await page.getByText('Total: $16.99', { exact: true }).waitFor()
    assert.notEqual(
      await failed.evaluate((button) => getComputedStyle(button).animationName),
      'none',
    )
    assert.equal(await failed.evaluate((button) => button === document.activeElement), true)
    assert.equal(await failed.getAttribute('aria-disabled'), null)
    await remove.waitFor()
    let response = page.waitForResponse((response) => response.request().method() === 'POST')
    await remove.press('Enter')
    assert.equal((await response).status(), 503)
    await failed.waitFor()
    assert.equal(await failed.getAttribute('aria-disabled'), null)
    assert.equal(mutations, 2)
    await page.reload()
    await page.getByRole('link', { name: 'Browse Books', exact: true }).waitFor()
    assert.equal(methods.filter((method) => method === 'POST').length, 2)
    assert.equal(mutations, 2)
    assert.equal(new URL(page.url()).pathname, '/cart')
  })

  it('keeps native submissions on their document URLs and displays cart errors once', async (t) => {
    let router = await createTestRouter()
    let mutations: string[] = []
    let server = await createTestServer(async (request) => {
      let response = await router.fetch(request)
      if (request.method === 'POST')
        mutations.push(`${new URL(request.url).pathname} ${response.status}`)
      return response
    })
    let runtimePage = await t.serve(server)
    let browser = runtimePage.context().browser()
    assert.ok(browser)
    let context = await browser.newContext({ baseURL: server.baseUrl, javaScriptEnabled: false })
    t.after(() => context.close())
    let page = await context.newPage()
    await page.request.post('/cart/api/add', { form: { bookId: '1' } })
    mutations.length = 0
    await page.goto('/cart')
    let quantity = page.getByRole('spinbutton', { name: 'Quantity of Ash & Smoke' })
    await quantity.fill('1.5')
    await quantity.evaluate((input: HTMLInputElement) => {
      if (!input.form) throw new Error('Missing quantity form')
      input.form.noValidate = true
    })
    await page.getByRole('button', { name: 'Update', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Invalid quantity' }).waitFor()
    assert.deepEqual(mutations, ['/cart/items 303'])
    assert.equal(new URL(page.url()).pathname, '/cart')
    assert.equal(await quantity.inputValue(), '1.5')
    assert.equal(await quantity.getAttribute('aria-invalid'), 'true')
    let errorId = await quantity.getAttribute('aria-describedby')
    assert.ok(errorId)
    assert.equal(await page.locator(`[id="${errorId}"]`).textContent(), 'Invalid quantity')
    assert.equal(
      await quantity.evaluate((input) => getComputedStyle(input).borderColor),
      'rgb(220, 38, 38)',
    )
    await page.getByText('Total: $16.99', { exact: true }).waitFor()

    await page.reload()
    assert.equal(new URL(page.url()).pathname, '/cart')
    assert.equal(await quantity.inputValue(), '1')
    assert.equal(await quantity.getAttribute('aria-invalid'), null)
    assert.equal(await page.getByRole('alert').count(), 0)
    mutations.length = 0
    await quantity.fill('2')
    await page.getByRole('button', { name: 'Update', exact: true }).click()
    await page.getByText('Total: $33.98', { exact: true }).waitFor()
    assert.deepEqual(mutations, ['/cart/items 303'])
    assert.equal(new URL(page.url()).pathname, '/cart')
    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    await page.getByText('Your cart is empty.', { exact: true }).waitFor()
    assert.deepEqual(mutations, ['/cart/items 303', '/cart/items 303'])
    assert.equal(new URL(page.url()).pathname, '/cart')

    await page.request.post('/cart/api/add', { form: { bookId: '3' } })
    await page.goto('/cart')
    let row = page.getByRole('row').filter({ hasText: 'Three Ways to Change Your Life' })
    await row.getByRole('spinbutton').fill('2')
    await row.getByRole('button', { name: 'Update', exact: true }).click()
    await row.getByRole('alert').getByText('Couldn’t update this book. Try again.').waitFor()
    assert.equal(new URL(page.url()).pathname, '/cart')
    await row.getByRole('button', { name: 'Remove', exact: true }).click()
    await row.getByRole('alert').getByText('Couldn’t remove this book. Try again.').waitFor()
    assert.equal(new URL(page.url()).pathname, '/cart')
    await page.reload()
    assert.equal(await page.getByRole('alert').count(), 0)
  })
})

async function serveCart(
  t: TestContext,
  intercept: (
    request: Request,
    respond: () => Promise<Response>,
  ) => void | Response | Promise<void | Response>,
  bookIds = ['1'],
  path = '/cart',
): Promise<Page> {
  let router = await createTestRouter()
  let page = await t.serve(
    await createTestServer(async (request) => {
      if (new URL(request.url).pathname === '/cart/api/add') return router.fetch(request)
      return (await intercept(request, () => router.fetch(request))) ?? router.fetch(request)
    }),
  )
  for (let bookId of bookIds) {
    await page.request.post('/cart/api/add', { form: { bookId } })
  }
  await page.goto(path)
  await page.evaluate(async () => {
    let script = document.querySelector<HTMLScriptElement>('script[type="module"][src]')
    if (!script) throw new Error('Missing app entry')
    let { app } = await import(script.src)
    await app.ready()
  })
  return page
}

async function frameState(page: Page) {
  return page.evaluate(async () => {
    let script = document.querySelector<HTMLScriptElement>('script[type="module"][src]')
    if (!script) throw new Error('Missing app entry')
    let { app } = await import(script.src)
    return { src: app.frames.get('cart')?.src, url: location.href, historyLength: history.length }
  })
}
