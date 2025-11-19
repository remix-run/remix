import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from './router.ts'
import { getSessionCookie, assertContains } from '../test/helpers.ts'

describe('auth handlers', () => {
  it('POST /login with valid credentials sets session cookie and redirects', async () => {
    let response = await router.fetch('https://remix.run/login', {
      method: 'POST',
      body: new URLSearchParams({
        email: 'admin@bookstore.com',
        password: 'admin123',
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/account')

    let sessionId = getSessionCookie(response)
    assert.ok(sessionId, 'Expected session cookie to be set')
  })

  it('POST /login with invalid credentials redirects back to login with error', async () => {
    let response = await router.fetch('https://remix.run/login', {
      method: 'POST',
      body: new URLSearchParams({
        email: 'wrong@example.com',
        password: 'wrongpassword',
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/login')

    // Follow redirect to see the error message
    let sessionCookie = getSessionCookie(response)
    let followUpResponse = await router.fetch('https://remix.run/login', {
      headers: {
        Cookie: `session=${sessionCookie}`,
      },
    })

    let html = await followUpResponse.text()
    assertContains(html, 'Invalid email or password')
  })

  it('POST /register creates new user and sets session', async () => {
    let uniqueEmail = `newuser-${Date.now()}@example.com`

    let response = await router.fetch('https://remix.run/register', {
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

    let sessionId = getSessionCookie(response)
    assert.ok(sessionId, 'Expected session cookie to be set')
  })

  it('accessing protected route redirects to login with returnTo parameter', async () => {
    let response = await router.fetch('https://remix.run/checkout', {
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location, 'Expected Location header')
    assert.ok(location.startsWith('/login?returnTo='), 'Expected redirect to login with returnTo')
    assert.ok(
      location.includes(encodeURIComponent('/checkout')),
      'Expected returnTo to contain /checkout',
    )
  })

  it('successful login with returnTo redirects to original destination', async () => {
    let response = await router.fetch(
      'https://remix.run/login?returnTo=' + encodeURIComponent('/checkout'),
      {
        method: 'POST',
        body: new URLSearchParams({
          email: 'customer@example.com',
          password: 'password123',
        }),
        redirect: 'manual',
      },
    )

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/checkout')

    let sessionId = getSessionCookie(response)
    assert.ok(sessionId, 'Expected session cookie to be set')
  })

  it('failed login with returnTo preserves returnTo parameter', async () => {
    let response = await router.fetch(
      'https://remix.run/login?returnTo=' + encodeURIComponent('/checkout'),
      {
        method: 'POST',
        body: new URLSearchParams({
          email: 'wrong@example.com',
          password: 'wrongpassword',
        }),
        redirect: 'manual',
      },
    )

    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location, 'Expected Location header')
    assert.ok(
      location.includes('returnTo=' + encodeURIComponent('/checkout')),
      'Expected returnTo to be preserved in redirect',
    )

    // Follow redirect to verify error message is shown
    let sessionCookie = getSessionCookie(response)
    let followUpResponse = await router.fetch('https://remix.run' + location, {
      headers: {
        Cookie: `session=${sessionCookie}`,
      },
    })

    let html = await followUpResponse.text()
    assertContains(html, 'Invalid email or password')
    assertContains(html, 'returnTo=' + encodeURIComponent('/checkout'))
  })
})
