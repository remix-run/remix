import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  assertContains,
  createTestRouter,
  loginAsCustomer,
  requestWithSession,
} from '../../../test/helpers.ts'

const router = await createTestRouter()

describe('account handlers', () => {
  it('GET /account redirects to login when not authenticated', async () => {
    let response = await router.fetch('https://remix.run/account')

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/login?returnTo=%2Faccount')
  })

  it('GET /account returns account page when authenticated', async () => {
    let sessionId = await loginAsCustomer(router)

    // Now access account page with session
    let request = requestWithSession('https://remix.run/account', sessionId)
    let response = await router.fetch(request)

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'My Account')
    assertContains(html, 'Account Information')
    assertContains(html, 'John Doe')
  })

  it('PUT /account/settings returns field errors without echoing a short password', async () => {
    let sessionId = await loginAsCustomer(router)
    let response = await router.fetch(
      requestWithSession('https://remix.run/account/settings', sessionId, {
        method: 'PUT',
        body: new URLSearchParams({
          name: 'Changed Name',
          email: 'new@example.com',
          password: 'short',
        }),
      }),
    )

    assert.equal(response.status, 400)
    let html = await response.text()
    assertContains(html, 'value="Changed Name"')
    assertContains(html, 'value="new@example.com"')
    assertContains(html, 'aria-invalid="true"')
    assert.ok(!html.includes('value="short"'))
  })

  it('GET /account/orders/:orderId shows order for authenticated user', async () => {
    let sessionId = await loginAsCustomer(router)

    // Access existing order
    let request = requestWithSession('https://remix.run/account/orders/1001', sessionId)
    let response = await router.fetch(request)

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Order #1001')
    assertContains(html, 'Ash &amp; Smoke')
  })

  it('GET /account/orders shows item counts from normalized order items', async () => {
    let sessionId = await loginAsCustomer(router)
    let request = requestWithSession('https://remix.run/account/orders', sessionId)
    let response = await router.fetch(request)

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, '2 item(s)')
    assertContains(html, '1 item(s)')
  })
})
