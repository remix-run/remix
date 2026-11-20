import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { users } from './data/schema.ts'
import { db } from './db.ts'
import { createTestRouter, getSessionCookie, testOrigin, withSession } from '../test/helpers.ts'

function postForm(path: string, fields: Record<string, string>, init: RequestInit = {}) {
  return new Request(new URL(path, testOrigin), {
    ...init,
    method: 'POST',
    body: new URLSearchParams(fields),
  })
}

describe('passkeys demo router', () => {
  it('renders the sign-in and sign-up forms', async () => {
    let router = await createTestRouter()
    let response = await router.fetch(new URL('/', testOrigin))
    let html = await response.text()

    assert.equal(response.status, 200)
    assert.ok(html.includes('Sign in with a passkey'))
    assert.ok(html.includes('Create account with a passkey'))
    assert.ok(html.includes('autocomplete="username webauthn"'))
  })

  it('redirects signed-out visitors away from the account page', async () => {
    let router = await createTestRouter()
    let response = await router.fetch(new URL('/account', testOrigin))

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/')
  })

  it('returns registration options for a new username', async () => {
    let router = await createTestRouter()
    let response = await router.fetch(postForm('/auth/signup/options', { username: ' Ada ' }))
    let options = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(options.rp, { id: 'passkeys.test', name: 'Remix Passkeys Demo' })
    assert.equal(options.user.name, 'ada')
    assert.equal(options.attestation, 'none')
    assert.deepEqual(options.authenticatorSelection, {
      residentKey: 'required',
      requireResidentKey: true,
      userVerification: 'required',
    })
    assert.ok(getSessionCookie(response))
  })

  it('rejects usernames that are invalid or taken', async () => {
    let router = await createTestRouter()
    await db.create(users, { id: crypto.randomUUID(), username: 'grace', created_at: Date.now() })

    let invalid = await router.fetch(postForm('/auth/signup/options', { username: 'no spaces' }))
    assert.equal(invalid.status, 400)
    assert.match((await invalid.json()).error, /lowercase letters/)

    let taken = await router.fetch(postForm('/auth/signup/options', { username: 'Grace' }))
    assert.equal(taken.status, 409)
    assert.deepEqual(await taken.json(), { error: 'That username is taken.' })
  })

  it('rejects a sign-up that was never started', async () => {
    let router = await createTestRouter()
    let response = await router.fetch(
      new Request(new URL('/auth/signup', testOrigin), { method: 'POST', body: '{}' }),
    )

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'Your sign-up expired. Please try again.' })
  })

  it('rejects a sign-up response that does not answer the challenge', async () => {
    let router = await createTestRouter()
    let optionsResponse = await router.fetch(postForm('/auth/signup/options', { username: 'ada' }))
    let sessionCookie = getSessionCookie(optionsResponse)
    assert.ok(sessionCookie)

    let response = await router.fetch(
      new URL('/auth/signup', testOrigin),
      withSession(sessionCookie, { method: 'POST', body: JSON.stringify({ type: 'public-key' }) }),
    )

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      error: 'We could not verify your passkey. Please try again.',
    })
    assert.equal(await db.count(users), 0)
  })

  it('returns usernameless sign-in options', async () => {
    let router = await createTestRouter()
    let response = await router.fetch(postForm('/auth/login/options', {}))
    let options = await response.json()

    assert.equal(response.status, 200)
    assert.equal(options.rpId, 'passkeys.test')
    assert.deepEqual(options.allowCredentials, [])
    assert.equal(options.userVerification, 'required')
    assert.equal(typeof options.challenge, 'string')
  })

  it('rejects a sign-in response without a pending challenge', async () => {
    let router = await createTestRouter()
    let response = await router.fetch(
      new Request(new URL('/auth/login', testOrigin), { method: 'POST', body: '{}' }),
    )

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      error: 'We could not sign you in with that passkey.',
    })
  })

  it('rejects cross-site passkey requests', async () => {
    let router = await createTestRouter()
    let response = await router.fetch(
      postForm(
        '/auth/login/options',
        {},
        { headers: { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://evil.test' } },
      ),
    )

    assert.equal(response.status, 403)
  })
})
