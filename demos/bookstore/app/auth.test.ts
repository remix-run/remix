import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from './router.ts'
import { assertContains, getSessionCookie } from '../test/helpers.ts'

describe('auth handlers', () => {
  it('POST /login with valid credentials sets session cookie and redirects', async () => {
    let response = await router.fetch('http://localhost:3000/login', {
      method: 'POST',
      body: new URLSearchParams({
        email: 'admin@bookstore.com',
        password: 'admin123',
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/account')

    let sessionCookie = getSessionCookie(response)
    assert.ok(sessionCookie, 'Expected session cookie to be set')
  })

  it('POST /login with invalid credentials returns 401', async () => {
    let response = await router.fetch('http://localhost:3000/login', {
      method: 'POST',
      body: new URLSearchParams({
        email: 'wrong@example.com',
        password: 'wrongpassword',
      }),
    })

    assert.equal(response.status, 401)
    let html = await response.text()
    assertContains(html, 'Invalid email or password')
  })

  it('POST /register creates new user and sets session', async () => {
    let uniqueEmail = `newuser-${Date.now()}@example.com`

    let response = await router.fetch('http://localhost:3000/register', {
      method: 'POST',
      body: new URLSearchParams({
        name: 'New User',
        email: uniqueEmail,
        password: 'password123',
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/account')

    let sessionCookie = getSessionCookie(response)
    assert.ok(sessionCookie, 'Expected session cookie to be set')
  })
})
