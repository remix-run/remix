import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { assertContains, createTestRouter, getSessionCookie } from '../../../test/helpers.ts'

const router = await createTestRouter()

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

  it('POST /login with invalid credentials returns a populated form with an error', async () => {
    let response = await router.fetch('https://remix.run/login', {
      method: 'POST',
      body: new URLSearchParams({
        email: 'wrong@example.com',
        password: 'wrongpassword',
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 400)
    assert.equal(response.headers.get('Location'), null)

    let html = await response.text()
    assertContains(html, 'Invalid email or password')
    assertContains(html, 'value="wrong@example.com"')
    assert.ok(!html.includes('wrongpassword'), 'Expected submitted password to be omitted')
  })

  it('POST /login does not treat wildcard characters as email matches', async () => {
    let response = await router.fetch('https://remix.run/login', {
      method: 'POST',
      body: new URLSearchParams({
        email: '%@bookstore.com',
        password: 'admin123',
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 400)

    let html = await response.text()
    assertContains(html, 'Invalid email or password')
    assertContains(html, 'value="%@bookstore.com"')
  })

  it('POST /login with an invalid shape returns field errors and native constraints', async () => {
    let response = await router.fetch('https://remix.run/login', {
      method: 'POST',
      body: new URLSearchParams({
        email: 'not-an-email',
      }),
    })

    assert.equal(response.status, 400)

    let html = await response.text()
    assertContains(html, 'type="email" required')
    assertContains(html, 'value="not-an-email"')
    assertContains(html, 'aria-invalid="true"')
    assertContains(html, 'aria-describedby="email-error"')
    assertContains(html, 'id="email-error" role="alert"')
    assertContains(html, 'id="password-error" role="alert"')
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

    assert.equal(response.status, 400)
    assert.equal(response.headers.get('Location'), null)

    let html = await response.text()
    assertContains(html, 'Invalid email or password')
    assertContains(html, 'action="/login?returnTo=' + encodeURIComponent('/checkout') + '"')
  })

  it('POST /reset-password with mismatched passwords redirects back with error', async () => {
    // First, request a password reset to get a token
    let forgotPasswordResponse = await router.fetch('https://remix.run/forgot-password', {
      method: 'POST',
      body: new URLSearchParams({
        email: 'customer@example.com',
      }),
    })

    let html = await forgotPasswordResponse.text()
    // Extract token from the reset link in the demo response
    let tokenMatch = html.match(/\/reset-password\/([^"]+)/)
    assert.ok(tokenMatch, 'Expected to find reset token in response')
    let token = tokenMatch[1]

    // Try to reset password with mismatched passwords
    let response = await router.fetch(`https://remix.run/reset-password/${token}`, {
      method: 'POST',
      body: new URLSearchParams({
        password: 'newpassword123',
        confirmPassword: 'differentpassword',
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), `/reset-password/${token}`)

    // Follow redirect to see the error message
    let sessionCookie = getSessionCookie(response)
    let followUpResponse = await router.fetch(`https://remix.run/reset-password/${token}`, {
      headers: {
        Cookie: `session=${sessionCookie}`,
      },
    })

    let errorHtml = await followUpResponse.text()
    assertContains(errorHtml, 'Passwords do not match')
  })

  it('POST /reset-password with invalid token redirects back with error', async () => {
    let invalidToken = 'invalid-token-12345'

    let response = await router.fetch(`https://remix.run/reset-password/${invalidToken}`, {
      method: 'POST',
      body: new URLSearchParams({
        password: 'newpassword123',
        confirmPassword: 'newpassword123',
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), `/reset-password/${invalidToken}`)

    // Follow redirect to see the error message
    let sessionCookie = getSessionCookie(response)
    let followUpResponse = await router.fetch(`https://remix.run/reset-password/${invalidToken}`, {
      headers: {
        Cookie: `session=${sessionCookie}`,
      },
    })

    let errorHtml = await followUpResponse.text()
    assertContains(errorHtml, 'Invalid or expired reset token')
  })
})
