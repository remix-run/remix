import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createDataModelFormsRouter } from '../../router.ts'
import { routes } from '../../routes.ts'

describe('registration controller', () => {
  it('renders model-derived native constraints', async () => {
    let router = createDataModelFormsRouter()
    let response = await router.fetch(
      new Request('http://localhost' + routes.registration.index.href()),
    )
    let html = await response.text()

    assert.equal(response.status, 200)
    assert.match(html, /name="displayName"[^>]*required[^>]*minlength="2"[^>]*maxlength="50"/)
    assert.match(html, /name="age"[^>]*type="number"[^>]*min="18"[^>]*max="120"/)
    assert.match(html, /name="terms"[^>]*type="checkbox"[^>]*required/)
  })

  it('returns populated field errors without restoring the password', async () => {
    let router = createDataModelFormsRouter()
    let formData = new FormData()
    formData.set('displayName', 'A')
    formData.set('email', 'not-an-email')
    formData.set('age', '12')
    formData.set('website', 'not-a-url')
    formData.set('password', 'short')

    let response = await router.fetch(
      new Request('http://localhost' + routes.registration.action.href(), {
        method: 'POST',
        body: formData,
      }),
    )
    let html = await response.text()

    assert.equal(response.status, 400)
    assert.match(html, /value="A"/)
    assert.match(html, /value="not-an-email"/)
    assert.match(html, /aria-invalid="true"/)
    assert.match(html, /Expected at least 2 characters/)
    assert.match(html, /Expected valid email/)
    assert.match(html, /I agree to the terms of service/)
    assert.doesNotMatch(html, /value="short"/)
  })

  it('renders the typed non-sensitive values after validation', async () => {
    let router = createDataModelFormsRouter()
    let formData = new FormData()
    formData.set('displayName', 'Ada Lovelace')
    formData.set('email', 'ada@example.com')
    formData.set('age', '36')
    formData.set('website', 'https://example.com')
    formData.set('password', 'correct horse battery staple')
    formData.set('terms', 'on')

    let response = await router.fetch(
      new Request('http://localhost' + routes.registration.action.href(), {
        method: 'POST',
        body: formData,
      }),
    )
    let html = await response.text()

    assert.equal(response.status, 200)
    assert.match(html, /The payload is typed and ready to use/)
    assert.match(html, /Ada Lovelace/)
    assert.match(html, /ada@example\.com/)
    assert.match(html, />36</)
    assert.doesNotMatch(html, /correct horse battery staple/)
  })
})
