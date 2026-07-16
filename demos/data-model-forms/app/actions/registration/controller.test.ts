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
    assert.match(html, /No accounts have been stored yet/)
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

    let storedResponse = await router.fetch(
      new Request('http://localhost' + routes.registration.index.href()),
    )
    let storedHtml = await storedResponse.text()

    assert.match(storedHtml, /No accounts have been stored yet/)
  })

  it('persists typed non-sensitive values across requests', async () => {
    let router = createDataModelFormsRouter()

    let response = await router.fetch(
      new Request('http://localhost' + routes.registration.action.href(), {
        method: 'POST',
        body: createValidRegistrationFormData(),
      }),
    )

    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), routes.registration.index.href())

    let storedResponse = await router.fetch(
      new Request('http://localhost' + routes.registration.index.href()),
    )
    let html = await storedResponse.text()

    assert.equal(storedResponse.status, 200)
    assert.match(html, /Stored in SQLite/)
    assert.match(html, /Ada Lovelace/)
    assert.match(html, /ada@example\.com/)
    assert.match(html, />36</)
    assert.match(html, /https:\/\/example\.com/)
    assert.doesNotMatch(html, /correct horse battery staple/)
  })

  it('isolates the in-memory database for each router', async () => {
    let firstRouter = createDataModelFormsRouter()
    let secondRouter = createDataModelFormsRouter()

    let createResponse = await firstRouter.fetch(
      new Request('http://localhost' + routes.registration.action.href(), {
        method: 'POST',
        body: createValidRegistrationFormData(),
      }),
    )

    assert.equal(createResponse.status, 303)

    let response = await secondRouter.fetch(
      new Request('http://localhost' + routes.registration.index.href()),
    )
    let html = await response.text()

    assert.match(html, />0 accounts</)
    assert.match(html, /No accounts have been stored yet/)
  })
})

function createValidRegistrationFormData(): FormData {
  let formData = new FormData()
  formData.set('displayName', 'Ada Lovelace')
  formData.set('email', 'ada@example.com')
  formData.set('age', '36')
  formData.set('website', 'https://example.com')
  formData.set('password', 'correct horse battery staple')
  formData.set('terms', 'on')
  return formData
}
