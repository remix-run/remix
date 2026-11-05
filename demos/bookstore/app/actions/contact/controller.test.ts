import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { assertContains, createTestRouter } from '../../../test/helpers.ts'

const router = await createTestRouter()

describe('contact controller', () => {
  it('POST /contact returns success message', async () => {
    let response = await router.fetch('https://remix.run/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        name: 'Test User',
        email: 'test@example.com',
        message: 'Test message',
      }).toString(),
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Thank you for your message')
  })

  it('POST /contact returns field errors and restores submitted text', async () => {
    let response = await router.fetch('https://remix.run/contact', {
      method: 'POST',
      body: new URLSearchParams({ name: 'Ada', email: 'ada@example.com', message: '' }),
    })

    assert.equal(response.status, 400)
    let html = await response.text()
    assertContains(html, 'value="Ada"')
    assertContains(html, 'name="message"')
    assertContains(html, 'aria-invalid="true"')
  })
})
