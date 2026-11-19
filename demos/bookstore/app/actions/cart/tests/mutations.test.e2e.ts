import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'
import { describe, it, type TestContext } from 'remix/test'
import type { Locator, Page } from 'playwright'

import { createTestRouter } from '../../../../test/helpers.ts'

describe('cart submissions', () => {
  it('keeps cart buttons idle while Back to Books loads the catalog', async (t) => {
    let requested = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let page = await serveCart(
      t,
      async (request) => {
        if (new URL(request.url).pathname !== '/books') return
        requested.resolve()
        await release.promise
      },
      [],
      '/books/bbq',
    )
    let details = page.getByRole('heading', { level: 1, name: 'Ash & Smoke' }).locator('..')
    await details
      .getByRole('link', { name: 'Back to Books', exact: true })
      .evaluate((anchor: HTMLAnchorElement) => anchor.click())
    await requested.promise
    await page.evaluate(async () => {
      let script = document.querySelector<HTMLScriptElement>('script[type="module"][src]')
      if (!script) throw new Error('Missing app entry')
      let { app } = await import(script.src)
      app.flush()
    })
    assert.equal(await details.getByRole('button', { name: 'Add to Cart', exact: true }).count(), 1)
    assert.equal(await page.getByRole('button', { name: 'Saving...', exact: true }).count(), 0)
    release.resolve()
    await page.getByRole('heading', { name: 'Browse Books', exact: true }).waitFor()
    await page.evaluate(async () => window.navigation.transition?.finished)
    await page.getByRole('link', { name: 'Ash & Smoke', exact: true }).scrollIntoViewIfNeeded()
    let card = page.locator('[data-test-slug="bbq"]')
    await card.getByRole('button', { name: 'Add to Cart', exact: true }).click()
    await card.getByRole('button', { name: 'Remove from Cart', exact: true }).waitFor()
  })

  it('submits once and safely retries add and remove after lost responses', async (t) => {
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
    let bookDetails = page.getByRole('heading', { level: 1, name: 'Ash & Smoke' }).locator('..')
    requests.length = 0
    let initial = await frameState(page)
    await bookDetails.getByRole('button', { name: 'Add to Cart', exact: true }).press('Enter')
    await received.promise
    let pending = bookDetails.getByRole('button', { name: 'Saving...', exact: true })
    await pending.waitFor()
    assert.equal(await pending.getAttribute('aria-disabled'), 'true')
    await pending.evaluate((button: HTMLButtonElement) => button.form?.requestSubmit(button))
    release.resolve()
    let remove = bookDetails.getByRole('button', { name: 'Remove from Cart', exact: true })
    await remove.waitFor()
    assert.equal(await remove.evaluate((button) => button === document.activeElement), true)
    await remove.press('Enter')
    await bookDetails.getByRole('button', { name: 'Add to Cart', exact: true }).waitFor()
    rejecting = true
    await bookDetails.getByRole('button', { name: 'Add to Cart', exact: true }).click()
    let failed = bookDetails.getByRole('button', { name: 'Failed!', exact: true })
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
    rejecting = false
    await failed.press('Enter')
    await remove.waitFor()
    rejecting = true
    await remove.press('Enter')
    await failed.waitFor()
    rejecting = false
    await failed.press('Enter')
    await bookDetails.getByRole('button', { name: 'Add to Cart', exact: true }).waitFor()
    await page.reload()
    await bookDetails.getByRole('button', { name: 'Add to Cart', exact: true }).waitFor()
    assert.equal(await page.getByRole('alert').count(), 0)
    assert.equal(requests.filter((request) => request.startsWith('POST')).length, 6)
    assert.deepEqual(await frameState(page), initial)
    await page.goto('/cart')
    await page.getByText('Your cart is empty.', { exact: true }).waitFor()
  })

  it('redirects native toggles to the initiating page and flashes errors on the matching book once', async (t) => {
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
    await card.locator('input[name="intent"]').evaluate((input: HTMLInputElement) => {
      input.value = 'invalid'
    })
    await card.getByRole('button', { name: 'Add to Cart', exact: true }).click()
    await card.getByRole('alert').getByText('Invalid cart action.').waitFor()
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

    await card.getByRole('button', { name: 'Add to Cart', exact: true }).click()
    await card.getByRole('button', { name: 'Remove from Cart', exact: true }).waitFor()
    await page.goto('/books/genre/self-help?from=native')
    await card.locator('input[name="intent"]').evaluate((input: HTMLInputElement) => {
      input.value = 'invalid'
    })
    await card.getByRole('button', { name: 'Remove from Cart', exact: true }).click()
    await card.getByRole('alert').getByText('Invalid cart action.').waitFor()
    assert.equal(
      new URL(page.url()).pathname + new URL(page.url()).search,
      '/books/genre/self-help?from=native',
    )
    assert.equal(await page.getByRole('alert').count(), 1)
    await page.reload()
    assert.equal(await page.getByRole('alert').count(), 0)
    await card.getByRole('button', { name: 'Remove from Cart', exact: true }).waitFor()
  })

  it('optimistically steps quantity through a PATCH override with pending prices and stable focus', async (t) => {
    let received = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let requests: string[] = []
    let page = await serveCart(t, async (request) => {
      if (new URL(request.url).pathname !== '/cart/items' || request.method !== 'POST') return
      let body = await request.clone().formData()
      requests.push(`${body.get('_method')} ${body.get('quantity')}`)
      received.resolve()
      await release.promise
    })
    let quantity = page.getByRole('status', { name: 'Quantity of Ash & Smoke' })
    let increase = page.getByRole('button', { name: 'Increase quantity of Ash & Smoke' })
    let decrease = page.getByRole('button', { name: 'Decrease quantity of Ash & Smoke' })
    let initial = await frameState(page)
    assert.equal(await quantity.textContent(), '1')
    assert.equal(await decrease.isDisabled(), true)
    assert.equal(await page.getByRole('spinbutton').count(), 0)
    await increase.press('Enter')
    await received.promise
    await page.waitForFunction(() => document.querySelector('output')?.textContent === '2')
    assert.equal(await increase.getAttribute('aria-disabled'), 'true')
    assert.equal(await increase.evaluate((button) => button === document.activeElement), true)
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
    assert.deepEqual(await frameState(page), initial)

    // A second submission while saving must not start another session write.
    await increase.evaluate((button: HTMLButtonElement) => button.form?.requestSubmit(button))
    release.resolve()
    await page.getByText('Total: $33.98', { exact: true }).waitFor()
    assert.equal(await quantity.textContent(), '2')
    assert.equal(await increase.getAttribute('aria-disabled'), null)
    assert.equal(await row.getByRole('cell').nth(3).textContent(), '$33.98')
    assert.equal(await page.locator('[aria-busy="true"]').count(), 0)
    assert.deepEqual(requests, ['PATCH 2'])
    assert.deepEqual(await frameState(page), initial)
    assert.equal(await increase.evaluate((button) => button === document.activeElement), true)
    await decrease.click()
    await page.getByText('Total: $16.99', { exact: true }).waitFor()
    assert.equal(await quantity.textContent(), '1')
    assert.equal(await decrease.isDisabled(), true)
    assert.deepEqual(requests, ['PATCH 2', 'PATCH 1'])
  })

  it('scopes rejected quantities to their row and restores the saved number before retry', async (t) => {
    let mutations = 0
    let page = await serveCart(
      t,
      (request) => {
        if (request.method === 'POST') mutations++
      },
      ['1', '2'],
    )
    let first = page.getByRole('status', { name: 'Quantity of Ash & Smoke' })
    let second = page.getByRole('status', { name: 'Quantity of Heavy Metal Guitar Riffs' })
    let increase = page.getByRole('button', { name: 'Increase quantity of Ash & Smoke' })
    // The UI only offers integer steps; the server still rejects a tampered submission.
    await increase.evaluate((button: HTMLButtonElement) => {
      button.value = '1.5'
    })
    let rejected = page.waitForResponse((response) => response.request().method() === 'POST')
    await increase.click()
    assert.equal((await rejected).status(), 400)
    let row = page.getByRole('row').filter({ hasText: 'Ash & Smoke' })
    let error = row.getByRole('alert')
    await error.waitFor()
    assert.equal(await error.textContent(), 'Invalid quantity')
    assert.equal(await first.textContent(), '1')
    assert.equal(await first.getAttribute('aria-describedby'), await error.getAttribute('id'))
    assert.equal(await second.textContent(), '1')
    assert.equal(await second.getAttribute('aria-describedby'), null)
    await page
      .getByRole('button', { name: 'Increase quantity of Heavy Metal Guitar Riffs' })
      .click()
    await page.getByText('Total: $70.99', { exact: true }).waitFor()
    assert.equal(await second.textContent(), '2')
    await increase.evaluate((button: HTMLButtonElement) => {
      button.value = '2'
    })
    await increase.click()
    await page.getByText('Total: $87.98', { exact: true }).waitFor()
    assert.equal(await first.textContent(), '2')
    assert.equal(await first.getAttribute('aria-describedby'), null)
    await error.waitFor({ state: 'detached' })
    assert.equal(mutations, 3)
  })

  it('rolls back an optimistic quantity on request failure and allows a direct keyboard retry', async (t) => {
    let reject = true
    let mutations = 0
    let received = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let page = await serveCart(t, async (request) => {
      if (new URL(request.url).pathname !== '/cart/items' || request.method !== 'POST') return
      mutations++
      received.resolve()
      await release.promise
      if (reject) return new Response('Unavailable', { status: 503 })
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    let quantity = page.getByRole('status', { name: 'Quantity of Ash & Smoke' })
    let increase = page.getByRole('button', { name: 'Increase quantity of Ash & Smoke' })
    let row = page.getByRole('row').filter({ hasText: 'Ash & Smoke' })
    let initialRow = await row.boundingBox()
    await increase.click()
    await received.promise
    await page.waitForFunction(() => document.querySelector('output')?.textContent === '2')
    release.resolve()
    let error = row.getByRole('alert')
    await error.waitFor()
    assert.equal(await error.textContent(), 'Couldn’t update quantity. Try again.')
    assert.equal(await quantity.textContent(), '1')
    assert.equal(await increase.getAttribute('aria-disabled'), null)
    assert.equal(await increase.evaluate((button) => button === document.activeElement), true)
    assert.deepEqual(await row.boundingBox(), initialRow)
    await page.getByText('Total: $16.99', { exact: true }).waitFor()
    reject = false
    await increase.press('Enter')
    await page.getByText('Total: $33.98', { exact: true }).waitFor()
    assert.equal(await quantity.textContent(), '2')
    await error.waitFor({ state: 'detached' })
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
    let quantity = page.getByRole('status', { name: 'Quantity of Ash & Smoke' })
    await page.getByRole('button', { name: 'Increase quantity of Ash & Smoke' }).click()
    await page
      .getByRole('alert')
      .filter({ hasText: 'Couldn’t update quantity. Try again.' })
      .waitFor()
    assert.equal(await quantity.textContent(), '1')
    await page.getByText('Total: $16.99', { exact: true }).waitFor()
    assert.deepEqual(methods, ['POST'])
    await page.reload()
    assert.equal(await page.getByRole('alert').count(), 0)
    assert.equal(await quantity.textContent(), '2')
    await page.getByText('Total: $33.98', { exact: true }).waitFor()
    assert.equal(mutations, 1)
  })

  it('removes immediately, keeps a compact Undo row, then collapses it when the window expires', async (t) => {
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
      '/cart',
      true,
    )
    let initial = await frameState(page)
    requests.length = 0
    let row = page.locator('tbody tr').filter({ hasText: 'Ash & Smoke' })
    let initialRow = await row.boundingBox()
    assert.ok(initialRow)
    let nextRow = page.locator('tbody tr').filter({ hasText: 'Heavy Metal Guitar Riffs' })
    let initialNextRow = await nextRow.boundingBox()
    assert.ok(initialNextRow)
    await row.getByRole('button', { name: 'Remove', exact: true }).press('Enter')
    await received.promise
    let undo = row.getByRole('button', { name: 'Undo', exact: true })
    await undo.waitFor()
    await row.evaluate(async (row) => {
      row.getBoundingClientRect()
      await Promise.all(
        row
          .getAnimations({ subtree: true })
          .filter((animation) => animation instanceof CSSTransition)
          .map((animation) => animation.finished),
      )
    })
    let compact = await row.boundingBox()
    assert.ok(compact && compact.height > 0 && compact.height < initialRow.height)
    assert.equal(await row.getByRole('status', { name: 'Quantity of Ash & Smoke' }).count(), 0)
    let movedRow = await nextRow.boundingBox()
    assert.ok(movedRow && movedRow.y < initialNextRow.y)
    await page.locator('[aria-busy="true"]').filter({ hasText: 'Total: $43.99' }).waitFor()
    assert.equal(await row.getAttribute('inert'), null)
    assert.equal(await undo.evaluate((button) => button === document.activeElement), true)
    assert.deepEqual(await frameState(page), initial)
    await nextRow
      .getByRole('button', { name: 'Increase quantity of Heavy Metal Guitar Riffs' })
      .evaluate((button: HTMLButtonElement) => button.form?.requestSubmit(button))
    release.resolve()
    await page.getByText('Total: $27.00', { exact: true }).waitFor()
    await page.getByRole('region', { name: 'Shopping cart', exact: true }).focus()
    await page.clock.fastForward(1999)
    assert.equal(await undo.count(), 1)
    await row.evaluate((row) => {
      row.addEventListener('transitionrun', () => {
        if (!row.hasAttribute('inert')) return
        for (let animation of row.getAnimations({ subtree: true })) animation.pause()
      })
    })
    await page.clock.fastForward(1)
    await page.waitForFunction(() =>
      document
        .querySelector('tbody tr[inert]')
        ?.getAnimations({ subtree: true })
        .some((animation) => animation.playState === 'paused'),
    )
    assert.equal(await row.count(), 1)
    await row.evaluate((row) => {
      for (let animation of row.getAnimations({ subtree: true })) animation.finish()
    })
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

  it('shows Undo time remaining and resets and pauses the countdown while hovered', async (t) => {
    let page = await serveCart(t, () => {}, ['1'], '/cart', true)
    let row = page.locator('tbody tr')
    await row.getByRole('button', { name: 'Remove', exact: true }).click()
    let undo = row.getByRole('button', { name: 'Undo', exact: true })
    await undo.waitFor()
    await page.getByText('Total: $0.00', { exact: true }).waitFor()
    await page.mouse.move(0, 0)
    assert.equal(await undo.evaluate((button) => button === document.activeElement), true)
    let fill = undo.locator('span[aria-hidden="true"]')
    assert.equal(await fill.evaluate((fill) => getComputedStyle(fill).transitionDuration), '2s')
    await page.clock.fastForward(1500)
    await fill.evaluate((fill) => {
      let animation = fill.getAnimations()[0]
      if (!animation) throw new Error('Missing Undo countdown animation')
      animation.pause()
      animation.currentTime = 1500
      fill.addEventListener('transitionrun', (event) => {
        if (
          !(event instanceof TransitionEvent) ||
          event.propertyName !== 'transform' ||
          getComputedStyle(fill).transitionDuration !== '0.2s'
        )
          return
        for (let animation of fill.getAnimations()) animation.pause()
      })
    })
    assert.ok(
      await fill.evaluate((fill) => new DOMMatrix(getComputedStyle(fill).transform).a < 0.5),
    )
    await undo.hover()
    await page.waitForFunction(() => {
      let fill = document.querySelector('button span[aria-hidden="true"]')
      return (
        fill &&
        getComputedStyle(fill).transitionDuration === '0.2s' &&
        fill.getAnimations().some((animation) => animation.playState === 'paused')
      )
    })
    assert.ok(await fill.evaluate((fill) => new DOMMatrix(getComputedStyle(fill).transform).a < 1))
    await fill.evaluate(async (fill) => {
      let animation = fill.getAnimations()[0]
      if (!animation) throw new Error('Missing Undo refill transition')
      animation.finish()
      await animation.finished
    })
    assert.equal(
      await fill.evaluate((fill) => new DOMMatrix(getComputedStyle(fill).transform).a),
      1,
    )
    await page.clock.fastForward(6000)
    assert.equal(await undo.count(), 1)
    assert.equal(await row.getAttribute('inert'), null)
    await page.mouse.move(0, 0)
    await page.waitForFunction(() => {
      let fill = document.querySelector('button span[aria-hidden="true"]')
      return fill && getComputedStyle(fill).transitionDuration === '2s'
    })
    await page.clock.fastForward(1999)
    assert.equal(await undo.count(), 1)
    await page.clock.fastForward(1)
    await page.getByText('Your cart is empty.', { exact: true }).waitFor()
  })

  it('pauses Undo for keyboard focus and keeps it paused until both focus and hover leave', async (t) => {
    let page = await serveCart(t, () => {}, ['1'], '/cart', true)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    let row = page.locator('tbody tr')
    await row.getByRole('button', { name: 'Remove', exact: true }).press('Enter')
    let undo = row.getByRole('button', { name: 'Undo', exact: true })
    await undo.waitFor()
    await page.getByText('Total: $0.00', { exact: true }).waitFor()
    assert.equal(await undo.evaluate((button) => button === document.activeElement), true)
    assert.equal(
      await undo
        .locator('span[aria-hidden="true"]')
        .evaluate((fill) => getComputedStyle(fill).transitionDuration),
      '0s',
    )
    await page.clock.fastForward(6000)
    assert.equal(await undo.count(), 1)
    await undo.hover()
    await page.getByRole('region', { name: 'Shopping cart', exact: true }).focus()
    await page.clock.fastForward(6000)
    assert.equal(await undo.count(), 1)
    await page.mouse.move(0, 0)
    await page.clock.fastForward(1999)
    assert.equal(await undo.count(), 1)
    await page.clock.fastForward(1)
    await page.getByText('Your cart is empty.', { exact: true }).waitFor()
  })

  it('keeps prices and controls stationary while the row bottom shrinks and they fade out', async (t) => {
    let received = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let page = await serveCart(
      t,
      async (request) => {
        if (new URL(request.url).pathname !== '/cart/items' || request.method !== 'POST') return
        received.resolve()
        await release.promise
      },
      ['1', '2'],
      '/cart',
      true,
    )
    let row = page.locator('tbody tr').filter({ hasText: 'Ash & Smoke' })
    let initial = await row.evaluate((row: HTMLTableRowElement) => {
      let range = document.createRange()
      range.selectNodeContents(row.cells[1])
      let priceY = range.getBoundingClientRect().y
      range.selectNodeContents(row.cells[3])
      let subtotalY = range.getBoundingClientRect().y
      let form = row.querySelector('form[aria-label]')
      let remove = row.querySelector('form:has(input[value="DELETE"]) button')
      if (!form || !remove) throw new Error('Missing cart controls')
      let positions = {
        priceY,
        subtotalY,
        quantityY: form.getBoundingClientRect().y,
        buttonY: remove.getBoundingClientRect().y,
      }
      let controller = new AbortController()
      row.addEventListener(
        'transitionrun',
        (event) => {
          if (!(event instanceof TransitionEvent) || event.propertyName !== 'padding-bottom') return
          controller.abort()
          for (let animation of row.getAnimations({ subtree: true })) {
            if (animation instanceof CSSTransition && animation.transitionProperty !== 'transform')
              animation.pause()
          }
        },
        { signal: controller.signal },
      )
      return { positions, height: row.getBoundingClientRect().height }
    })
    await row.getByRole('button', { name: 'Remove', exact: true }).press('Enter')
    await received.promise
    await row.getByRole('button', { name: 'Undo', exact: true }).waitFor()
    await page.waitForFunction(() =>
      document
        .querySelector('tbody tr')
        ?.getAnimations({ subtree: true })
        .some(
          (animation) =>
            animation instanceof CSSTransition &&
            animation.transitionProperty === 'padding-bottom' &&
            animation.playState === 'paused',
        ),
    )
    let midway = await row.evaluate((row: HTMLTableRowElement) => {
      for (let animation of row.getAnimations({ subtree: true })) {
        if (!(animation instanceof CSSTransition) || animation.transitionProperty === 'transform')
          continue
        let duration = animation.effect?.getTiming().duration
        if (typeof duration === 'number') animation.currentTime = duration / 2
      }
      let range = document.createRange()
      range.selectNodeContents(row.cells[1])
      let priceY = range.getBoundingClientRect().y
      range.selectNodeContents(row.cells[3])
      let subtotalY = range.getBoundingClientRect().y
      let form = row.querySelector('form[aria-label]')
      let undo = row.querySelector('button[type="button"]')
      let priceContent = row.cells[1].querySelector('[aria-hidden="true"]')
      if (!form || !undo || !priceContent) throw new Error('Missing cart contents')
      return {
        positions: {
          priceY,
          subtotalY,
          quantityY: form.getBoundingClientRect().y,
          buttonY: undo.getBoundingClientRect().y,
        },
        height: row.getBoundingClientRect().height,
        opacity: Number(getComputedStyle(priceContent).opacity),
      }
    })
    assert.deepEqual(midway.positions, initial.positions)
    assert.ok(midway.height < initial.height)
    assert.ok(midway.opacity > 0 && midway.opacity < 1)
    await row.evaluate((row) => {
      for (let animation of row.getAnimations({ subtree: true })) {
        if (animation instanceof CSSTransition && animation.transitionProperty !== 'transform')
          animation.finish()
      }
    })
    release.resolve()
    await page.getByText('Total: $27.00', { exact: true }).waitFor()
  })

  it('keeps cart columns and controls in place when a long title changes to removed text', async (t) => {
    let received = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let page = await serveCart(
      t,
      async (request) => {
        if (new URL(request.url).pathname !== '/cart/items' || request.method !== 'POST') return
        received.resolve()
        await release.promise
      },
      ['3'],
      '/cart',
      true,
    )
    let row = page.locator('tbody tr')
    let initialColumns = await row.evaluate((row: HTMLTableRowElement) =>
      [...row.cells].map((cell) => {
        let { x, width } = cell.getBoundingClientRect()
        return { x, width }
      }),
    )
    let thumbnail = await row.locator('img').boundingBox()
    assert.ok(thumbnail)
    let remove = row.getByRole('button', { name: 'Remove', exact: true })
    let initialButton = await remove.boundingBox()
    assert.ok(initialButton)
    await remove.press('Enter')
    await received.promise
    let undo = row.getByRole('button', { name: 'Undo', exact: true })
    await undo.waitFor()
    let removedTitle = row.getByText('Three Ways to Change Your Life removed', { exact: true })
    await removedTitle.waitFor()
    assert.equal(
      await row
        .getByRole('link', { name: 'Three Ways to Change Your Life', exact: true })
        .getAttribute('href'),
      '/books/three-ways',
    )
    assert.equal(
      await row.getByText('removed', { exact: true }).evaluate((text) => text.closest('a')),
      null,
    )
    assert.equal(
      await removedTitle.evaluate((title) => getComputedStyle(title).fontStyle),
      'normal',
    )
    let compactColumns = await row.evaluate((row: HTMLTableRowElement) =>
      [...row.cells].map((cell) => {
        let { x, width } = cell.getBoundingClientRect()
        return { x, width }
      }),
    )
    assert.deepEqual(compactColumns, initialColumns)
    let compactThumbnail = await row.locator('img').boundingBox()
    assert.ok(compactThumbnail)
    assert.equal(compactThumbnail.width, thumbnail.width)
    assert.equal(compactThumbnail.height, thumbnail.height)
    let undoButton = await undo.boundingBox()
    assert.ok(undoButton)
    assert.equal(undoButton.x, initialButton.x)
    await undo.press('Enter')
    release.resolve()
    await remove.waitFor()
    await page.getByText('Total: $28.99', { exact: true }).waitFor()
    assert.deepEqual(
      await row.evaluate((row: HTMLTableRowElement) =>
        [...row.cells].map((cell) => {
          let { x, width } = cell.getBoundingClientRect()
          return { x, width }
        }),
      ),
      initialColumns,
    )
    await page.setViewportSize({ width: 390, height: 844 })
    let tableViewport = page.locator('table').locator('..')
    assert.equal(
      await tableViewport.evaluate((viewport) => {
        let table = viewport.querySelector('table')
        if (!table) throw new Error('Missing cart table')
        return (
          getComputedStyle(viewport).overflowX === 'auto' &&
          table.getBoundingClientRect().width > viewport.clientWidth
        )
      }),
      true,
    )
    let quantityControl = row.locator(
      'form[aria-label="Update quantity of Three Ways to Change Your Life"]',
    )
    assert.equal(
      await quantityControl.evaluate((form) => {
        let cell = form.closest('td')
        if (!cell) throw new Error('Missing quantity cell')
        let controlBounds = form.getBoundingClientRect()
        let cellBounds = cell.getBoundingClientRect()
        return controlBounds.x >= cellBounds.x && controlBounds.right <= cellBounds.right
      }),
      true,
    )
  })

  it('collapses the last row before rendering the confirmed server empty state', async (t) => {
    let received = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let page = await serveCart(
      t,
      async (request) => {
        if (request.method === 'POST') {
          received.resolve()
          await release.promise
        }
      },
      ['1'],
      '/cart',
      true,
    )
    await page.emulateMedia({ reducedMotion: 'reduce' })
    let row = page.locator('tbody tr')
    await row.getByRole('button', { name: 'Remove', exact: true }).press('Enter')
    await received.promise
    await row.getByRole('button', { name: 'Undo', exact: true }).waitFor()
    await page.getByRole('region', { name: 'Shopping cart', exact: true }).focus()
    await page.clock.fastForward(2000)
    await collapsedRow(row)
    assert.equal(await page.getByText('Your cart is empty.', { exact: true }).count(), 0)
    await page.locator('[aria-busy="true"]').filter({ hasText: 'Total: $16.99' }).waitFor()
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

  it('expands a failed removal back in with button feedback and reconciles a lost response', async (t) => {
    let mutations = 0
    let received = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let methods: string[] = []
    let page = await serveCart(
      t,
      async (request, respond) => {
        if (!new URL(request.url).pathname.startsWith('/cart/items')) return
        methods.push(request.method)
        if (request.method !== 'POST') return
        mutations++
        if (mutations === 1) {
          received.resolve()
          await release.promise
        }
        if (mutations === 2) await (await respond()).text()
        return new Response('Unavailable', { status: 503 })
      },
      ['1'],
      '/cart',
      true,
    )
    let row = page.locator('tbody tr').filter({ hasText: 'Ash & Smoke' })
    let initialRow = await row.boundingBox()
    let remove = row.getByRole('button', { name: 'Remove', exact: true })
    await remove.press('Enter')
    await received.promise
    await row.getByRole('button', { name: 'Undo', exact: true }).waitFor()
    await page.getByRole('region', { name: 'Shopping cart', exact: true }).focus()
    await page.clock.fastForward(2000)
    await collapsedRow(row)
    release.resolve()
    let failed = row.getByRole('button', { name: 'Failed!', exact: true })
    await failed.waitFor()
    assert.equal(await page.getByRole('alert').count(), 0)
    await row.evaluate(async (row) => {
      await Promise.all(
        row
          .getAnimations({ subtree: true })
          .filter((animation) => animation instanceof CSSTransition)
          .map((animation) => animation.finished),
      )
    })
    assert.deepEqual(await row.boundingBox(), initialRow)
    await page.getByText('Total: $16.99', { exact: true }).waitFor()
    assert.notEqual(
      await failed.evaluate((button) => getComputedStyle(button).animationName),
      'none',
    )
    assert.equal(await failed.evaluate((button) => button === document.activeElement), true)
    assert.equal(await failed.getAttribute('aria-disabled'), null)
    await page.clock.fastForward(2000)
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

  it('optimistically undoes an unfinished removal and restores the saved quantity in its original position', async (t) => {
    let removeReceived = Promise.withResolvers<void>()
    let releaseRemove = Promise.withResolvers<void>()
    let restoreReceived = Promise.withResolvers<void>()
    let releaseRestore = Promise.withResolvers<void>()
    t.after(() => {
      releaseRemove.resolve()
      releaseRestore.resolve()
    })
    let requests: string[] = []
    let page = await serveCart(
      t,
      async (request) => {
        if (new URL(request.url).pathname !== '/cart/items' || request.method !== 'POST') return
        let body = await request.clone().formData()
        requests.push(
          `${body.get('_method') ?? 'POST'} ${body.get('bookId')} ${body.get('quantity') ?? ''}`,
        )
        if (body.get('_method') === 'DELETE') {
          removeReceived.resolve()
          await releaseRemove.promise
        } else {
          restoreReceived.resolve()
          await releaseRestore.promise
        }
      },
      ['1', '1', '1', '2'],
      '/cart',
      true,
    )
    let initial = await frameState(page)
    let row = page.locator('tbody tr').filter({ hasText: 'Ash & Smoke' })
    await row.getByRole('button', { name: 'Remove', exact: true }).press('Enter')
    await removeReceived.promise
    let undo = row.getByRole('button', { name: 'Undo', exact: true })
    await undo.press('Enter')
    await row.getByRole('button', { name: 'Restoring...', exact: true }).waitFor()
    assert.equal(
      await row.getByRole('status', { name: 'Quantity of Ash & Smoke' }).textContent(),
      '3',
    )
    assert.deepEqual(requests, ['DELETE 1 '])
    releaseRemove.resolve()
    await restoreReceived.promise
    await page.locator('[aria-busy="true"]').filter({ hasText: 'Total: $27.00' }).waitFor()
    assert.deepEqual(requests, ['DELETE 1 ', 'POST 1 3'])
    releaseRestore.resolve()
    await page.getByText('Total: $77.97', { exact: true }).waitFor()
    let remove = row.getByRole('button', { name: 'Remove', exact: true })
    await remove.waitFor()
    assert.equal(await remove.evaluate((button) => button === document.activeElement), true)
    assert.deepEqual(await page.locator('tbody tr td:first-child a').allTextContents(), [
      'Ash & Smoke',
      'Heavy Metal Guitar Riffs',
    ])
    await page.clock.fastForward(2000)
    assert.equal(await row.count(), 1)
    assert.deepEqual(await frameState(page), initial)
    await page.reload()
    await page.getByText('Total: $77.97', { exact: true }).waitFor()
    assert.equal(
      await row.getByRole('status', { name: 'Quantity of Ash & Smoke' }).textContent(),
      '3',
    )
  })

  it('keeps multiple Undo windows and restores rows in page order even when undone in reverse order', async (t) => {
    let page = await serveCart(t, () => {}, ['1', '2', '3'], '/cart', true)
    let first = page.locator('tbody tr').filter({ hasText: 'Ash & Smoke' })
    let second = page.locator('tbody tr').filter({ hasText: 'Heavy Metal Guitar Riffs' })
    await first.getByRole('button', { name: 'Remove', exact: true }).click()
    await page.getByText('Total: $55.99', { exact: true }).waitFor()
    await second.getByRole('button', { name: 'Remove', exact: true }).click()
    await page.getByText('Total: $28.99', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Undo', exact: true }).count(), 2)
    await second.getByRole('button', { name: 'Undo', exact: true }).click()
    await page.getByText('Total: $55.99', { exact: true }).waitFor()
    await first.getByRole('button', { name: 'Undo', exact: true }).click()
    await page.getByText('Total: $72.98', { exact: true }).waitFor()
    await page.clock.fastForward(2000)
    assert.deepEqual(await page.locator('tbody tr td:first-child a').allTextContents(), [
      'Ash & Smoke',
      'Heavy Metal Guitar Riffs',
      'Three Ways to Change Your Life',
    ])
    assert.equal(await page.getByRole('button', { name: 'Undo', exact: true }).count(), 0)
  })

  it('keeps a failed Undo available and safely retries a lost restore response', async (t) => {
    let restores = 0
    let page = await serveCart(
      t,
      async (request, respond) => {
        if (new URL(request.url).pathname !== '/cart/items' || request.method !== 'POST') return
        if ((await request.clone().formData()).get('_method') === 'DELETE') return
        restores++
        if (restores === 1) return new Response('Unavailable', { status: 503 })
        if (restores === 2) {
          await (await respond()).text()
          return new Response('Unavailable', { status: 503 })
        }
      },
      ['1', '1'],
      '/cart',
      true,
    )
    await page.emulateMedia({ reducedMotion: 'reduce' })
    let row = page.locator('tbody tr').filter({ hasText: 'Ash & Smoke' })
    await row.getByRole('button', { name: 'Remove', exact: true }).press('Enter')
    await page.getByText('Total: $0.00', { exact: true }).waitFor()
    await row.getByRole('button', { name: 'Undo', exact: true }).press('Enter')
    let failed = row.getByRole('button', { name: 'Failed!', exact: true })
    await failed.waitFor()
    assert.equal(await row.getByRole('status', { name: 'Quantity of Ash & Smoke' }).count(), 0)
    await page.clock.fastForward(2000)
    await row.getByRole('button', { name: 'Undo', exact: true }).press('Enter')
    await failed.waitFor()
    assert.equal(restores, 2)
    await failed.press('Enter')
    await row.getByRole('button', { name: 'Remove', exact: true }).waitFor()
    await page.getByText('Total: $33.98', { exact: true }).waitFor()
    assert.equal(
      await row.getByRole('status', { name: 'Quantity of Ash & Smoke' }).textContent(),
      '2',
    )
    assert.equal(restores, 3)
  })

  it('discards queued Undo work and local rows when navigating away', async (t) => {
    let received = Promise.withResolvers<void>()
    let release = Promise.withResolvers<void>()
    t.after(() => release.resolve())
    let restores = 0
    let page = await serveCart(
      t,
      async (request) => {
        if (new URL(request.url).pathname !== '/cart/items' || request.method !== 'POST') return
        if ((await request.clone().formData()).get('_method') === 'DELETE') {
          received.resolve()
          await release.promise
        } else restores++
      },
      ['1'],
      '/cart',
      true,
    )
    let row = page.locator('tbody tr')
    await row.getByRole('button', { name: 'Remove', exact: true }).press('Enter')
    await received.promise
    await row.getByRole('button', { name: 'Undo', exact: true }).press('Enter')
    await row.getByRole('button', { name: 'Restoring...', exact: true }).waitFor()
    await page.getByRole('link', { name: 'Continue Shopping', exact: true }).click()
    await page.getByRole('heading', { name: 'Browse Books', exact: true }).waitFor()
    release.resolve()
    await page.clock.fastForward(2000)
    await page.goBack()
    await page.getByRole('heading', { name: 'Shopping Cart', exact: true }).waitFor()
    await page.evaluate(async () => {
      let script = document.querySelector<HTMLScriptElement>('script[type="module"][src]')
      if (!script) throw new Error('Missing app entry')
      let { app } = await import(script.src)
      await app.ready()
    })
    assert.equal(await page.getByRole('button', { name: 'Undo', exact: true }).count(), 0)
    assert.equal(restores, 0)
  })

  it('flashes native validation once, then updates and removes books while staying on /cart', async (t) => {
    let router = await createTestRouter()
    let mutations: string[] = []
    let server = await createTestServer(async (request) => {
      let method =
        request.method === 'POST'
          ? ((await request.clone().formData()).get('_method') ?? 'POST')
          : request.method
      let response = await router.fetch(request)
      if (request.method === 'POST') {
        mutations.push(`${method} ${new URL(request.url).pathname} ${response.status}`)
      }
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
    let quantity = page.getByRole('status', { name: 'Quantity of Ash & Smoke' })
    let increase = page.getByRole('button', { name: 'Increase quantity of Ash & Smoke' })
    await increase.evaluate((button: HTMLButtonElement) => {
      button.value = '1.5'
    })
    await increase.click()
    let error = page.getByRole('alert').filter({ hasText: 'Invalid quantity' })
    await error.waitFor()
    assert.deepEqual(mutations, ['PATCH /cart/items 303'])
    assert.equal(new URL(page.url()).pathname, '/cart')
    assert.equal(await quantity.textContent(), '1')
    assert.equal(await quantity.getAttribute('aria-describedby'), await error.getAttribute('id'))
    await page.getByText('Total: $16.99', { exact: true }).waitFor()

    await page.reload()
    assert.equal(new URL(page.url()).pathname, '/cart')
    assert.equal(await quantity.textContent(), '1')
    assert.equal(await quantity.getAttribute('aria-describedby'), null)
    assert.equal(await page.getByRole('alert').count(), 0)
    assert.deepEqual(mutations, ['PATCH /cart/items 303'])

    mutations.length = 0
    await page.getByRole('button', { name: 'Increase quantity of Ash & Smoke' }).click()
    await page.getByText('Total: $33.98', { exact: true }).waitFor()
    assert.deepEqual(mutations, ['PATCH /cart/items 303'])
    assert.equal(new URL(page.url()).pathname, '/cart')
    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    await page.getByText('Your cart is empty.', { exact: true }).waitFor()
    assert.deepEqual(mutations, ['PATCH /cart/items 303', 'DELETE /cart/items 303'])
    assert.equal(new URL(page.url()).pathname, '/cart')

    await page.request.post('/cart/api/add', { form: { bookId: '3' } })
    await page.goto('/cart')
    let row = page.getByRole('row').filter({ hasText: 'Three Ways to Change Your Life' })
    await row
      .getByRole('button', { name: 'Increase quantity of Three Ways to Change Your Life' })
      .click()
    await page.getByText('Total: $57.98', { exact: true }).waitFor()
    assert.equal(await page.getByRole('alert').count(), 0)
    assert.equal(new URL(page.url()).pathname, '/cart')
    await row.getByRole('button', { name: 'Remove', exact: true }).click()
    await page.getByText('Your cart is empty.', { exact: true }).waitFor()
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
  freezeTime = false,
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
  if (freezeTime) await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
  await page.goto(path)
  await page.evaluate(async () => {
    let script = document.querySelector<HTMLScriptElement>('script[type="module"][src]')
    if (!script) throw new Error('Missing app entry')
    let { app } = await import(script.src)
    await app.ready()
  })
  if (freezeTime) await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'))
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

async function collapsedRow(row: Locator): Promise<void> {
  await row.waitFor({ state: 'attached' })
  await row.evaluate(async (row: HTMLTableRowElement) => {
    if (!row.inert) {
      await new Promise<void>((resolve) => {
        let observer = new MutationObserver(() => {
          if (!row.inert) return
          observer.disconnect()
          resolve()
        })
        observer.observe(row, { attributes: true, attributeFilter: ['inert'] })
      })
    }
    row.getBoundingClientRect()
    await Promise.all(
      row
        .getAnimations({ subtree: true })
        .filter((animation) => animation instanceof CSSTransition)
        .map((animation) => animation.finished),
    )
  })
}
