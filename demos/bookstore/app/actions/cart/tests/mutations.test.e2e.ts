import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it, type TestContext } from 'remix/test'
import type { Page } from 'playwright'

import { createTestRouter } from '../../../../test/helpers.ts'

describe('cart submissions', () => {
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
    await page.getByText('Total: ---', { exact: true }).waitFor()
    let row = page.getByRole('row').filter({ hasText: 'Ash & Smoke' })
    assert.equal(await row.getByRole('cell').nth(3).textContent(), '---')
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
    await quantity.fill('4')
    await quantity.press('Enter')
    await page.getByRole('alert').filter({ hasText: 'Couldn’t update your cart.' }).waitFor()
    await page.getByText('Total: $16.99', { exact: true }).waitFor()
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

  it('recovers the saved quantity with GET when the mutation response is lost', async (t) => {
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
    await page.getByRole('alert').waitFor()
    await page.getByText('Total: $16.99', { exact: true }).waitFor()
    assert.equal(await quantity.inputValue(), '1')
    assert.deepEqual(methods, ['POST'])
    await page.getByRole('button', { name: 'reload cart', exact: true }).click()
    await page.getByRole('alert').waitFor({ state: 'detached' })
    await page.getByText('Total: $50.97', { exact: true }).waitFor()
    assert.deepEqual(methods, ['POST', 'GET'])
    assert.equal(mutations, 1)
  })

  it('removes a row with one DELETE override and keeps focus on the cart', async (t) => {
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
    await row.waitFor({ state: 'detached' })
    await page.getByText('Total: ---', { exact: true }).waitFor()
    assert.equal(
      await page.getByRole('button', { name: 'Remove', exact: true }).getAttribute('aria-disabled'),
      'true',
    )
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
      'Shopping cart',
    )
    assert.deepEqual(await frameState(page), initial)
    await page
      .locator('form:has(input[name="_method"])')
      .evaluate((form: HTMLFormElement) => form.requestSubmit())
    release.resolve()
    await page.locator('button[aria-disabled="true"]').first().waitFor({ state: 'detached' })
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

  it('keeps focus through optimistic removal of the last item and the server empty state', async (t) => {
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
    await page.getByText('Your cart is empty.', { exact: true }).waitFor()
    await page.getByText('Total: ---', { exact: true }).waitFor()
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
      'Shopping cart',
    )
    release.resolve()
    await page.getByRole('link', { name: 'Browse Books', exact: true }).waitFor()
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
      'Shopping cart',
    )
  })

  it('restores a failed removal and reconciles a lost response with a GET', async (t) => {
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
    let remove = page.getByRole('button', { name: 'Remove', exact: true })
    await remove.press('Enter')
    await page.getByRole('alert').filter({ hasText: 'Couldn’t update your cart.' }).waitFor()
    await remove.waitFor()
    await page.getByText('Total: $16.99', { exact: true }).waitFor()
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
      'Shopping cart',
    )
    assert.equal(await remove.getAttribute('aria-disabled'), null)
    let response = page.waitForResponse((response) => response.request().method() === 'POST')
    await remove.press('Enter')
    assert.equal((await response).status(), 503)
    await remove.waitFor()
    assert.equal(await remove.getAttribute('aria-disabled'), null)
    assert.equal(mutations, 2)
    await page.getByRole('button', { name: 'reload cart', exact: true }).click()
    await page.getByRole('link', { name: 'Browse Books', exact: true }).waitFor()
    assert.equal(methods.at(-1), 'GET')
    assert.equal(mutations, 2)
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
      'Shopping cart',
    )
  })

  it('submits to the shared items URL with JavaScript disabled', async (t) => {
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
    await page.getByRole('spinbutton', { name: 'Quantity of Ash & Smoke' }).fill('2')
    await page.getByRole('button', { name: 'Update', exact: true }).click()
    await page.getByText('Total: $33.98', { exact: true }).waitFor()
    assert.deepEqual(mutations, ['/cart/items 303'])
    assert.equal(new URL(page.url()).pathname, '/cart')
    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    await page.getByText('Your cart is empty.', { exact: true }).waitFor()
    assert.deepEqual(mutations, ['/cart/items 303', '/cart/items 303'])
    assert.equal(new URL(page.url()).pathname, '/cart')
  })
})

async function serveCart(
  t: TestContext,
  intercept: (
    request: Request,
    respond: () => Promise<Response>,
  ) => void | Response | Promise<void | Response>,
  bookIds = ['1'],
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
  await page.goto('/cart')
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
