import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  assertContains,
  createTestRouter,
  getSessionCookie,
  requestWithSession,
  testOrigin,
} from '../../../../test/helpers.ts'

describe('passkey auth controller', () => {
  it('starts username-less passkey sign-in', async () => {
    let router = await createTestRouter()

    let response = await router.fetch(`${testOrigin}/auth/passkey/options`, { method: 'POST' })
    let options = await response.json()

    assert.equal(options.rpId, 'social-auth.test')
    assert.equal(options.userVerification, 'preferred')
    assert.deepEqual(options.allowCredentials, [])
  })

  it('returns to the login page with an error when verification fails', async () => {
    let router = await createTestRouter()
    let optionsResponse = await router.fetch(`${testOrigin}/auth/passkey/options`, {
      method: 'POST',
    })
    let sessionCookie = getSessionCookie(optionsResponse)
    assert.ok(sessionCookie)

    let response = await router.fetch(
      requestWithSession(`${testOrigin}/auth/passkey/login?returnTo=/account`, sessionCookie, {
        method: 'POST',
        body: new URLSearchParams({ response: 'not json' }),
      }),
    )
    let loginHtml = await (
      await router.fetch(requestWithSession(`${testOrigin}/`, sessionCookie))
    ).text()

    assert.equal(response.headers.get('Location'), '/?returnTo=%2Faccount')
    assertContains(loginHtml, 'We could not verify that passkey. Please try again.')
  })

  it('offers passkey sign-in on the passkey origin', async () => {
    let router = await createTestRouter()

    let html = await (await router.fetch(`${testOrigin}/`)).text()

    assertContains(html, 'Sign in with a passkey')
    assertContains(html, 'autocomplete="username webauthn"')
  })

  it('links to the passkey origin from other origins', async () => {
    let router = await createTestRouter()

    let html = await (await router.fetch('http://127.0.0.1:44100/?returnTo=/account')).text()

    assertContains(html, 'Open this page on social-auth.test')
    assertContains(html, 'href="https://social-auth.test/?returnTo=/account"')
  })
})
