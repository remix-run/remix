import * as assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'

import { router } from './router.ts'
import {
  getSessionCookie,
  assertContains,
  assertNotContains,
  requestWithSession,
  login,
  signup,
  getResetTokenFromEmail,
  setupTest,
} from '../test/helpers.ts'

describe('auth handlers', () => {
  beforeEach(() => {
    setupTest()
  })

  it('POST /signup creates new user and sets session', async () => {
    let uniqueEmail = `newuser-${Date.now()}@example.com`
    let name = 'Test User'

    let response = await router.fetch('https://remix.run/signup', {
      method: 'POST',
      body: new URLSearchParams({
        name,
        email: uniqueEmail,
        password: 'password123',
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/')

    let sessionId = getSessionCookie(response)
    assert.ok(sessionId, 'Expected session cookie to be set')

    // Verify user is logged in by checking home page
    let homeResponse = await router.fetch('https://remix.run/', {
      headers: {
        Cookie: `session=${sessionId}`,
      },
    })

    // Get updated session cookie if it changed
    let updatedSessionId = getSessionCookie(homeResponse) || sessionId

    // Fetch again with updated session
    homeResponse = await router.fetch('https://remix.run/', {
      headers: {
        Cookie: `session=${updatedSessionId}`,
      },
    })

    let html = await homeResponse.text()
    assertContains(html, name) // Should show user name in header
    assertNotContains(html, 'Log In') // Should not show Log In link
    assertNotContains(html, 'Register') // Should not show Register link
  })

  it('POST /signup with existing email shows error', async () => {
    let email = `existing-${Date.now()}@example.com`

    // Create user first
    await router.fetch('https://remix.run/signup', {
      method: 'POST',
      body: new URLSearchParams({
        name: 'Test User',
        email,
        password: 'password123',
      }),
    })

    // Try to create same user again
    let response = await router.fetch('https://remix.run/signup', {
      method: 'POST',
      body: new URLSearchParams({
        name: 'Test User 2',
        email,
        password: 'password123',
      }),
    })

    // Should render form with error directly (no redirect)
    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'An account with this email already exists')
  })

  it('POST /login with valid credentials sets session cookie and redirects', async () => {
    let email = `user-${Date.now()}@example.com`

    // Create user first
    await router.fetch('https://remix.run/signup', {
      method: 'POST',
      body: new URLSearchParams({
        email,
        password: 'password123',
      }),
    })

    // Now log in
    let response = await router.fetch('https://remix.run/login', {
      method: 'POST',
      body: new URLSearchParams({
        email,
        password: 'password123',
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/')

    let sessionId = getSessionCookie(response)
    assert.ok(sessionId, 'Expected session cookie to be set')
  })

  it('POST /login with invalid credentials renders error', async () => {
    let response = await router.fetch('https://remix.run/login', {
      method: 'POST',
      body: new URLSearchParams({
        email: 'wrong@example.com',
        password: 'wrongpassword',
      }),
    })

    // Should render form with error directly (no redirect)
    assert.equal(response.status, 200)

    let html = await response.text()
    assertContains(html, 'Invalid email or password')
  })

  it('accessing /account redirects to login when not authenticated', async () => {
    let response = await router.fetch('https://remix.run/account', {
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location, 'Expected Location header')
    assert.ok(location.startsWith('/login'), 'Expected redirect to login')
  })

  it('POST /account/logout clears session and redirects to home', async () => {
    let email = `user-${Date.now()}@example.com`

    // Create and log in user
    let signupResponse = await router.fetch('https://remix.run/signup', {
      method: 'POST',
      body: new URLSearchParams({
        email,
        password: 'password123',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(signupResponse)
    assert.ok(sessionId, 'Expected session cookie after signup')

    // Logout
    let logoutResponse = await router.fetch('https://remix.run/account/logout', {
      method: 'POST',
      headers: {
        Cookie: `session=${sessionId}`,
      },
      redirect: 'manual',
    })

    assert.equal(logoutResponse.status, 302)
    assert.equal(logoutResponse.headers.get('Location'), '/')

    // Verify user is logged out by checking home page
    let newSessionId = getSessionCookie(logoutResponse)
    let homeResponse = await router.fetch('https://remix.run/', {
      headers: {
        Cookie: `session=${newSessionId}`,
      },
    })

    let html = await homeResponse.text()
    assertContains(html, 'Log In') // Should show Log In link
    assertContains(html, 'Register') // Should show Register link
    assertNotContains(html, email) // Should not show user email
  })

  it('like button only shows when logged in', async () => {
    // Check home page when not logged in
    let guestResponse = await router.fetch('https://remix.run/')
    let guestHtml = await guestResponse.text()

    assertContains(guestHtml, '0 likes')
    assertNotContains(guestHtml, 'Like') // Should not show like button

    // Create and log in user
    let email = `user-${Date.now()}@example.com`
    let signupResponse = await router.fetch('https://remix.run/signup', {
      method: 'POST',
      body: new URLSearchParams({
        email,
        password: 'password123',
        name: 'Test User',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(signupResponse)

    // Check home page when logged in
    let userResponse = await router.fetch('https://remix.run/', {
      headers: {
        Cookie: `session=${sessionId}`,
      },
    })
    let userHtml = await userResponse.text()

    assertContains(userHtml, 'Like') // Should show like button
  })

  it('POST /posts/:id/like requires authentication', async () => {
    let response = await router.fetch('https://remix.run/posts/1/like', {
      method: 'POST',
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location, 'Expected Location header')
    assert.ok(location.startsWith('/login'), 'Expected redirect to login')
  })

  it('POST /posts/:id/like toggles like state', async () => {
    let email = `user-${Date.now()}@example.com`

    // Create and log in user
    let signupResponse = await router.fetch('https://remix.run/signup', {
      method: 'POST',
      body: new URLSearchParams({
        email,
        password: 'password123',
        name: 'Test User',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(signupResponse)

    // Get initial like count
    let homeResponseBefore = await router.fetch('https://remix.run/', {
      headers: {
        Cookie: `session=${sessionId}`,
      },
    })
    let htmlBefore = await homeResponseBefore.text()
    let matchBefore = htmlBefore.match(/Welcome to the Auth Demo![\s\S]*?(\d+) likes?/)
    let initialLikes = matchBefore ? parseInt(matchBefore[1]) : 0

    // Like a post
    let likeResponse = await router.fetch('https://remix.run/posts/1/like', {
      method: 'POST',
      headers: {
        Cookie: `session=${sessionId}`,
      },
      redirect: 'manual',
    })

    assert.equal(likeResponse.status, 302)
    assert.equal(likeResponse.headers.get('Location'), '/')

    // Check that like count increased
    let homeResponse1 = await router.fetch('https://remix.run/', {
      headers: {
        Cookie: `session=${sessionId}`,
      },
    })

    let html1 = await homeResponse1.text()

    // Extract the actual like count for the first post
    let match1 = html1.match(/Welcome to the Auth Demo![\s\S]*?(\d+) likes?/)
    let currentLikes = match1 ? parseInt(match1[1]) : 0

    assert.equal(
      currentLikes,
      initialLikes + 1,
      `Expected like count to increase from ${initialLikes} to ${initialLikes + 1}`,
    )
    assertContains(html1, 'Liked')

    // Unlike the post
    await router.fetch('https://remix.run/posts/1/like', {
      method: 'POST',
      headers: {
        Cookie: `session=${sessionId}`,
      },
    })

    // Check that like count returned to original
    let homeResponse2 = await router.fetch('https://remix.run/', {
      headers: {
        Cookie: `session=${sessionId}`,
      },
    })

    let html2 = await homeResponse2.text()

    // Extract the actual like count after unliking
    let match2 = html2.match(/Welcome to the Auth Demo![\s\S]*?(\d+) likes?/)
    let finalLikes = match2 ? parseInt(match2[1]) : 0

    assert.equal(finalLikes, initialLikes, `Expected like count to return to ${initialLikes}`)
    assertNotContains(html2, 'Liked')
  })

  it('POST /forgot-password generates reset token', async () => {
    let email = `user-${Date.now()}@example.com`
    await login(router, email, 'password123')

    let response = await router.fetch('https://remix.run/forgot-password', {
      method: 'POST',
      body: new URLSearchParams({ email }),
      redirect: 'manual',
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Password reset link sent')
    assertContains(html, 'Demo Mode')

    // Verify email was sent with reset token
    let token = getResetTokenFromEmail(email)
    assert.ok(token, 'Expected reset token to be sent via email')
  })

  it('POST /reset-password/:token with mismatched passwords shows error', async () => {
    let email = `user-${Date.now()}@example.com`
    await login(router, email, 'password123')

    // Request password reset and get token from email
    await router.fetch('https://remix.run/forgot-password', {
      method: 'POST',
      body: new URLSearchParams({ email }),
    })
    let token = getResetTokenFromEmail(email)
    assert.ok(token, 'Expected to find reset token in email')

    // Try to reset with mismatched passwords
    let resetResponse = await router.fetch(`https://remix.run/reset-password/${token}`, {
      method: 'POST',
      body: new URLSearchParams({
        password: 'newpassword',
        confirmPassword: 'differentpassword',
      }),
    })

    // Should render form with error directly (no redirect)
    assert.equal(resetResponse.status, 200)
    let html = await resetResponse.text()
    assertContains(html, 'Passwords do not match')
  })

  it('POST /reset-password/:token successfully resets password', async () => {
    let email = `user-${Date.now()}@example.com`
    await login(router, email, 'password123')

    // Request password reset and get token from email
    await router.fetch('https://remix.run/forgot-password', {
      method: 'POST',
      body: new URLSearchParams({ email }),
    })
    let token = getResetTokenFromEmail(email)
    assert.ok(token, 'Expected to find reset token in email')

    // Reset password
    let resetResponse = await router.fetch(`https://remix.run/reset-password/${token}`, {
      method: 'POST',
      body: new URLSearchParams({
        password: 'newpassword123',
        confirmPassword: 'newpassword123',
      }),
      redirect: 'manual',
    })

    assert.equal(resetResponse.status, 200)
    let html = await resetResponse.text()
    assertContains(html, 'Password reset successfully')

    // Try to login with new password
    let loginResponse = await router.fetch('https://remix.run/login', {
      method: 'POST',
      body: new URLSearchParams({ email, password: 'newpassword123' }),
      redirect: 'manual',
    })

    assert.equal(loginResponse.status, 302)
    assert.equal(loginResponse.headers.get('Location'), '/')
    assert.ok(getSessionCookie(loginResponse), 'Expected session cookie after login')
  })

  it('POST /account/change-password with mismatched passwords shows error', async () => {
    let email = `user-${Date.now()}@example.com`
    let sessionId = await login(router, email, 'password123')

    let response = await router.fetch(
      requestWithSession('https://remix.run/account/change-password', sessionId, {
        method: 'POST',
        body: new URLSearchParams({
          currentPassword: 'password123',
          newPassword: 'newpassword',
          confirmPassword: 'differentpassword',
        }),
      }),
    )

    // Should render form with error directly (no redirect)
    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'New passwords do not match')
  })

  it('POST /account/change-password with wrong current password shows error', async () => {
    let email = `user-${Date.now()}@example.com`
    let sessionId = await login(router, email, 'password123')

    let response = await router.fetch(
      requestWithSession('https://remix.run/account/change-password', sessionId, {
        method: 'POST',
        body: new URLSearchParams({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123',
          confirmPassword: 'newpassword123',
        }),
      }),
    )

    // Should render form with error directly (no redirect)
    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Current password is incorrect')
  })

  it('POST /account/change-password successfully changes password', async () => {
    let email = `user-${Date.now()}@example.com`
    let sessionId = await login(router, email, 'password123')

    let response = await router.fetch(
      requestWithSession('https://remix.run/account/change-password', sessionId, {
        method: 'POST',
        body: new URLSearchParams({
          currentPassword: 'password123',
          newPassword: 'newpassword123',
          confirmPassword: 'newpassword123',
        }),
      }),
    )

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Password Changed')
    assertContains(html, 'Your password has been changed successfully')

    // Logout and try to login with new password
    await router.fetch(
      requestWithSession('https://remix.run/account/logout', sessionId, {
        method: 'POST',
        redirect: 'manual',
      }),
    )

    let loginResponse = await router.fetch('https://remix.run/login', {
      method: 'POST',
      body: new URLSearchParams({ email, password: 'newpassword123' }),
      redirect: 'manual',
    })

    assert.equal(loginResponse.status, 302)
    assert.equal(loginResponse.headers.get('Location'), '/')
    assert.ok(
      getSessionCookie(loginResponse),
      'Expected session cookie after login with new password',
    )
  })
})
