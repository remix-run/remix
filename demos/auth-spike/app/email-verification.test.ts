import * as assert from 'node:assert/strict'
import { describe, test, beforeEach } from 'node:test'
import { router } from './router.ts'
import { authStorage, authClient, clearAuthStorage } from './utils/auth.ts'

// Import JWT utils directly from source for testing
import { signJWT } from '../../../packages/auth/src/lib/jwt.ts'

describe('Email Verification', () => {
  beforeEach(() => {
    clearAuthStorage()
  })

  test('signs up user and sends verification email', async () => {
    let signupData = new FormData()
    signupData.set('name', 'Test User')
    signupData.set('email', 'test@example.com')
    signupData.set('password', 'password123')

    let response = await router.fetch('https://app.example.com/signup', {
      method: 'POST',
      body: signupData,
      redirect: 'manual',
    })

    // Should redirect on success (user can sign in even if not verified)
    assert.equal(response.status, 302)

    // User should be created but not verified
    let user = authStorage.authUser?.find((u: any) => u.email === 'test@example.com')

    assert.ok(user)
    assert.equal(user.emailVerified, false)
  })

  test('verifies email with valid token', async () => {
    // Create a user
    let signupData = new FormData()
    signupData.set('name', 'Test User')
    signupData.set('email', 'test@example.com')
    signupData.set('password', 'password123')

    let signupResponse = await router.fetch('https://app.example.com/signup', {
      method: 'POST',
      body: signupData,
    })

    let signupSessionCookie = signupResponse.headers.get('Set-Cookie')
    assert.ok(signupSessionCookie)

    // Request verification
    let result = await authClient.emailVerification.requestVerification({
      email: 'test@example.com',
      request: new Request('https://app.example.com/'),
    })
    assert.equal(result.type, 'success')

    // Extract token from the test (in real app, this would be from email)
    // For testing, we'll generate a token directly
    let user = authStorage.authUser?.find((u: any) => u.email === 'test@example.com')
    assert.ok(user)

    // Create a test session and call verify directly
    let { createSession } = await import('@remix-run/session')
    let session = createSession()

    // Generate a valid JWT token (simulating what sendVerification would send)
    // Note: This uses the same secret as the email verification feature
    let token = await signJWT(
      { email: 'test@example.com' },
      'demo-secret-key-DO-NOT-USE-IN-PRODUCTION',
      3600,
    )

    let verifyResult = await authClient.emailVerification.verify({
      session,
      token,
      request: new Request('https://app.example.com/'),
    })

    assert.equal(verifyResult.type, 'success')
    assert.ok(verifyResult.data.user)
    assert.equal(verifyResult.data.user.emailVerified, true)
  })

  test('rejects invalid verification token', async () => {
    let { createSession } = await import('@remix-run/session')
    let session = createSession()

    let result = await authClient.emailVerification.verify({
      session,
      token: 'invalid-token',
      request: new Request('https://app.example.com/'),
    })

    assert.equal(result.type, 'error')
    assert.equal(result.code, 'invalid_or_expired_token')
  })

  test('rejects expired verification token', async () => {
    // Create a user
    let signupData = new FormData()
    signupData.set('name', 'Test User')
    signupData.set('email', 'test@example.com')
    signupData.set('password', 'password123')

    await router.fetch('https://app.example.com/signup', {
      method: 'POST',
      body: signupData,
    })

    let { createSession } = await import('@remix-run/session')
    let session = createSession()

    // Generate an expired JWT token
    let token = await signJWT(
      { email: 'test@example.com' },
      'demo-secret-key-DO-NOT-USE-IN-PRODUCTION',
      -1,
    ) // Already expired

    let result = await authClient.emailVerification.verify({
      session,
      token,
      request: new Request('https://app.example.com/'),
    })

    assert.equal(result.type, 'error')
    assert.equal(result.code, 'invalid_or_expired_token')
  })

  test('verification endpoint redirects with invalid token', async () => {
    let response = await router.fetch(
      'https://app.example.com/api/auth/email-verification/verify/invalid-token',
      {
        redirect: 'manual',
      },
    )

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/login')
  })

  test('verification endpoint sets session on success', async () => {
    // Create a user
    let signupData = new FormData()
    signupData.set('name', 'Test User')
    signupData.set('email', 'test@example.com')
    signupData.set('password', 'password123')

    await router.fetch('https://app.example.com/signup', {
      method: 'POST',
      body: signupData,
    })

    // Generate a valid JWT token
    let token = await signJWT(
      { email: 'test@example.com' },
      'demo-secret-key-DO-NOT-USE-IN-PRODUCTION',
      3600,
    )

    let response = await router.fetch(
      `https://app.example.com/api/auth/email-verification/verify/${token}`,
      {
        redirect: 'manual',
      },
    )

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/')

    let sessionCookie = response.headers.get('Set-Cookie')
    assert.ok(sessionCookie)

    // Verify user is now verified
    let user = authStorage.authUser?.find((u: any) => u.email === 'test@example.com')
    assert.ok(user)
    assert.equal(user.emailVerified, true)
  })

  test('requestVerification returns error for non-existent user', async () => {
    let result = await authClient.emailVerification.requestVerification({
      email: 'nonexistent@example.com',
      request: new Request('https://app.example.com/'),
    })

    assert.equal(result.type, 'error')
    assert.equal(result.code, 'user_not_found')
  })
})
