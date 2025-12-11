import * as assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import { createAuthClient } from './client.ts'
import type { MemoryDB } from './storage-adapters/memory.ts'
import { createMemoryStorageAdapter } from './storage-adapters/memory.ts'
import { createSession } from '@remix-run/session'

// Helper to create a test auth client
function createTestAuthClient(customConfig?: Partial<Parameters<typeof createAuthClient>[0]>) {
  let db: MemoryDB = {}

  return {
    auth: createAuthClient({
      secret: 'test-secret-key',
      password: {
        enabled: true,
      },
      storage: createMemoryStorageAdapter(db),
      rateLimit: { enabled: false }, // Disable rate limiting in tests
      ...customConfig,
    }),
    db,
  }
}

describe('createAuthClient', () => {
  describe('signUp.password', () => {
    it('creates a new user with hashed password', async () => {
      let { auth, db } = createTestAuthClient()
      let session = createSession()

      let result = await auth.password.signUp({
        request: new Request('http://test.example.com/'),
        session,
        email: 'test@example.com',
        password: 'mypassword123',
      })

      assert.equal(result.type, 'success')
      assert.equal(result.data.user.email, 'test@example.com')
      assert.equal(db.authUser.length, 1)

      // Password stored in account table
      let account = db.authAccount?.find(
        (a) => a.userId === result.data.user.id && a.strategy === 'password',
      )
      assert.ok(account, 'Expected password account to be created')
      assert.ok(account.passwordHash?.startsWith('pbkdf2:'))
    })

    it('normalizes email to lowercase', async () => {
      let { auth } = createTestAuthClient()
      let session = createSession()

      let result = await auth.password.signUp({
        request: new Request('http://test.example.com/'),
        session,
        email: 'Test@EXAMPLE.com',
        password: 'password123',
      })

      assert.equal(result.type, 'success')
      assert.equal(result.data.user.email, 'test@example.com')
    })

    it('returns error when email already exists', async () => {
      let { auth } = createTestAuthClient()
      let session = createSession()

      await auth.password.signUp({
        request: new Request('http://test.example.com/'),
        session,
        email: 'test@example.com',
        password: 'password123',
      })

      let result = await auth.password.signUp({
        request: new Request('http://test.example.com/'),
        session: createSession(),
        email: 'test@example.com',
        password: 'differentpassword',
      })

      assert.equal(result.type, 'error')
      assert.equal(result.code, 'email_taken')
    })
  })

  describe('signIn.password', () => {
    it('authenticates user with correct credentials', async () => {
      let { auth } = createTestAuthClient()
      let session = createSession()

      // Create user
      let signupResult = await auth.password.signUp({
        request: new Request('http://test.example.com/'),
        session,
        email: 'test@example.com',
        password: 'mypassword123',
      })
      assert.equal(signupResult.type, 'success')

      // Sign in
      let result = await auth.password.signIn({
        request: new Request('http://test.example.com/'),
        session,
        email: 'test@example.com',
        password: 'mypassword123',
      })

      assert.equal(result.type, 'success')
      assert.equal(result.data.user.id, signupResult.data.user.id)
      assert.equal(result.data.user.email, 'test@example.com')
    })

    it('normalizes email to lowercase', async () => {
      let { auth } = createTestAuthClient()
      let session = createSession()

      await auth.password.signUp({
        request: new Request('http://test.example.com/'),
        session,
        email: 'test@example.com',
        password: 'password123',
      })

      let result = await auth.password.signIn({
        request: new Request('http://test.example.com/'),
        session,
        email: 'Test@EXAMPLE.com',
        password: 'password123',
      })

      assert.equal(result.type, 'success')
      assert.equal(result.data.user.email, 'test@example.com')
    })

    it('returns error for non-existent user', async () => {
      let { auth } = createTestAuthClient()
      let session = createSession()

      let result = await auth.password.signIn({
        request: new Request('http://test.example.com/'),
        session,
        email: 'nonexistent@example.com',
        password: 'password123',
      })

      assert.equal(result.type, 'error')
      assert.equal(result.code, 'invalid_credentials')
    })

    it('returns error for incorrect password', async () => {
      let { auth } = createTestAuthClient()
      let session = createSession()

      await auth.password.signUp({
        request: new Request('http://test.example.com/'),
        session,
        email: 'test@example.com',
        password: 'correctpassword',
      })

      let result = await auth.password.signIn({
        request: new Request('http://test.example.com/'),
        session,
        email: 'test@example.com',
        password: 'wrongpassword',
      })

      assert.equal(result.type, 'error')
      assert.equal(result.code, 'invalid_credentials')
    })
  })

  describe('getUser', () => {
    it('returns user when session has valid userId', async () => {
      let { auth } = createTestAuthClient()
      let session = createSession()

      // Create user (automatically sets session)
      let signupResult = await auth.password.signUp({
        request: new Request('http://test.example.com/'),
        session,
        email: 'test@example.com',
        password: 'password123',
      })
      assert.equal(signupResult.type, 'success')

      // Get user from session
      let user = await auth.getUser(session)

      assert.ok(user)
      assert.equal(user.id, signupResult.data.user.id)
      assert.equal(user.email, 'test@example.com')
    })

    it('returns null when session has no userId', async () => {
      let { auth } = createTestAuthClient()

      let session = createSession()

      let user = await auth.getUser(session)

      assert.equal(user, null)
    })

    it('returns null when userId does not match any user', async () => {
      let { auth } = createTestAuthClient()

      let session = createSession()
      session.set('auth:userId', 'non-existent-id')

      let user = await auth.getUser(session)

      assert.equal(user, null)
    })
  })

  describe('signOut', () => {
    it('destroys the session', async () => {
      let { auth } = createTestAuthClient()
      let session = createSession()

      // Sign up (sets session)
      await auth.password.signUp({
        request: new Request('http://test.example.com/'),
        session,
        email: 'test@example.com',
        password: 'password123',
      })

      assert.ok(await auth.getUser(session), 'User should be in session')

      await auth.signOut(session)

      assert.ok(session.destroyed, 'Session should be destroyed')
    })
  })

  describe('passwordReset', () => {
    it('getResetToken returns user and token for existing user', async () => {
      let { auth } = createTestAuthClient()
      let session = createSession()

      // Create user
      let signupResult = await auth.password.signUp({
        request: new Request('http://test.example.com/'),
        session,
        email: 'test@example.com',
        password: 'password123',
      })
      assert.equal(signupResult.type, 'success')

      // Get reset token
      let result = await auth.password.getResetToken({
        email: 'test@example.com',
        request: new Request('http://test.example.com/'),
      })

      assert.equal(result.type, 'success')
      assert.equal(result.data.user.id, signupResult.data.user.id)
      assert.equal(result.data.user.email, 'test@example.com')
      assert.ok(result.data.token, 'Expected token to be returned')
      assert.equal(typeof result.data.token, 'string')
      assert.ok(result.data.token.length > 0)
    })

    it('getResetToken returns error for non-existent user', async () => {
      let { auth } = createTestAuthClient()

      let result = await auth.password.getResetToken({
        email: 'nonexistent@example.com',
        request: new Request('http://test.example.com/'),
      })

      assert.equal(result.type, 'error')
      assert.equal(result.code, 'user_not_found')
    })

    it('reset updates password with valid token', async () => {
      let { auth } = createTestAuthClient()
      let session = createSession()

      // Create user
      await auth.password.signUp({
        request: new Request('http://test.example.com/'),
        session,
        email: 'test@example.com',
        password: 'oldpassword',
      })

      // Get reset token
      let tokenResult = await auth.password.getResetToken({
        email: 'test@example.com',
        request: new Request('http://test.example.com/'),
      })
      assert.equal(tokenResult.type, 'success')

      let { token } = tokenResult.data

      // Reset password
      let resetResult = await auth.password.reset({
        session,
        token,
        newPassword: 'newpassword',
        request: new Request('http://test.example.com/'),
      })

      assert.equal(resetResult.type, 'success')
      assert.equal(resetResult.code, 'password_reset')
      assert.equal(resetResult.data.user.email, 'test@example.com')

      // Verify can login with new password
      let loginResult = await auth.password.signIn({
        request: new Request('http://test.example.com/'),
        session,
        email: 'test@example.com',
        password: 'newpassword',
      })

      assert.equal(loginResult.type, 'success')
    })

    it('reset returns error for invalid token', async () => {
      let { auth } = createTestAuthClient()
      let session = createSession()

      let result = await auth.password.reset({
        session,
        token: 'invalid-token',
        newPassword: 'newpassword',
        request: new Request('http://test.example.com/'),
      })

      assert.equal(result.type, 'error')
      assert.equal(result.code, 'invalid_or_expired_token')
    })

    it('reset invalidates token after use', async () => {
      let { auth } = createTestAuthClient()
      let session = createSession()

      // Create user and get reset token
      await auth.password.signUp({
        request: new Request('http://test.example.com/'),
        session,
        email: 'test@example.com',
        password: 'oldpassword',
      })

      let tokenResult = await auth.password.getResetToken({
        email: 'test@example.com',
        request: new Request('http://test.example.com/'),
      })
      assert.equal(tokenResult.type, 'success')

      let { token } = tokenResult.data

      // Reset password
      await auth.password.reset({
        session,
        token,
        newPassword: 'newpassword',
        request: new Request('http://test.example.com/'),
      })

      // Try to use token again
      let secondReset = await auth.password.reset({
        session,
        token,
        newPassword: 'anotherpassword',
        request: new Request('http://test.example.com/'),
      })

      assert.equal(secondReset.type, 'error')
      assert.equal(secondReset.code, 'invalid_or_expired_token')
    })
  })

  describe('custom session key', () => {
    it('uses custom session key when provided', async () => {
      let { auth } = createTestAuthClient({
        sessionKey: 'custom:userId',
      })
      let session = createSession()

      await auth.password.signUp({
        request: new Request('http://test.example.com/'),
        session,
        email: 'test@example.com',
        password: 'password123',
      })

      // Verify it's stored under custom key
      assert.ok(session.get('custom:userId'), 'Should have userId in custom key')
      assert.equal(typeof session.get('custom:userId'), 'string')
    })
  })

  describe('custom password functions', () => {
    it('uses custom hashPassword when provided', async () => {
      let customHash = mock.fn(async (password: string) => `custom-hash:${password}`)

      let db: MemoryDB = {}

      let auth = createAuthClient({
        secret: 'test-secret-key',
        storage: createMemoryStorageAdapter(db),
        rateLimit: { enabled: false },
        password: {
          enabled: true,
          algorithm: {
            hash: customHash,
            verify: async () => true, // Not used in this test
          },
        },
      })
      let session = createSession()

      let result = await auth.password.signUp({
        request: new Request('http://test.example.com/'),
        session,
        email: 'test@example.com',
        password: 'mypassword',
      })

      assert.equal(result.type, 'success', 'Expected signup to succeed')
      assert.equal(customHash.mock.callCount(), 1, 'Expected customHash to be called once')
      assert.deepEqual(customHash.mock.calls[0].arguments, ['mypassword'])

      // Check password stored in account table
      let account = db.authAccount?.find(
        (a) => a.userId === result.data.user.id && a.strategy === 'password',
      )
      assert.ok(account, 'Expected password account to be created')
      assert.equal(account.passwordHash, 'custom-hash:mypassword')
    })

    it('uses custom verifyPassword when provided', async () => {
      let customVerify = mock.fn(async (password: string, hash: string) => {
        return hash === `custom-hash:${password}`
      })

      let now = new Date()
      let db: MemoryDB = {
        authUser: [
          {
            id: '1',
            email: 'test@example.com',
          },
        ],
        authAccount: [
          {
            id: 'acc-1',
            userId: '1',
            strategy: 'password',
            accountId: 'test@example.com',
            passwordHash: 'custom-hash:correctpassword',
            createdAt: now,
            updatedAt: now,
          },
        ],
        authVerification: [],
      }

      let auth = createAuthClient({
        secret: 'test-secret-key',
        storage: createMemoryStorageAdapter(db),
        rateLimit: { enabled: false },
        password: {
          enabled: true,
          algorithm: {
            hash: async (password) => `custom-hash:${password}`,
            verify: customVerify,
          },
        },
      })
      let session = createSession()

      // Test correct password
      let result = await auth.password.signIn({
        request: new Request('http://test.example.com/'),
        session,
        email: 'test@example.com',
        password: 'correctpassword',
      })

      assert.equal(result.type, 'success', 'Expected login to succeed')
      assert.equal(customVerify.mock.callCount(), 1, 'Expected customVerify to be called once')
      assert.deepEqual(customVerify.mock.calls[0].arguments, [
        'correctpassword',
        'custom-hash:correctpassword',
      ])

      // Test incorrect password
      let failResult = await auth.password.signIn({
        request: new Request('http://test.example.com/'),
        session,
        email: 'test@example.com',
        password: 'wrongpassword',
      })

      assert.equal(failResult.type, 'error', 'Expected login to fail')
      assert.equal(customVerify.mock.callCount(), 2, 'Expected customVerify to be called twice')
      assert.deepEqual(customVerify.mock.calls[1].arguments, [
        'wrongpassword',
        'custom-hash:correctpassword',
      ])
    })

    it('uses default password functions when custom ones not provided', async () => {
      let db: MemoryDB = {}

      let auth = createAuthClient({
        secret: 'test-secret-key',
        storage: createMemoryStorageAdapter(db),
        rateLimit: { enabled: false },
        password: {
          enabled: true,
        },
        // No custom algorithm provided - uses default PBKDF2
      })
      let session = createSession()

      // Sign up with default hash
      let signupResult = await auth.password.signUp({
        request: new Request('http://test.example.com/'),
        session,
        email: 'test@example.com',
        password: 'mypassword',
      })

      assert.equal(signupResult.type, 'success', 'Expected signup to succeed')

      // Check password stored in account table with default PBKDF2 hash
      let account = db.authAccount?.find(
        (a) => a.userId === signupResult.data.user.id && a.strategy === 'password',
      )
      assert.ok(account, 'Expected password account to be created')
      assert.ok(account.passwordHash?.includes(':'), 'Expected PBKDF2 hash format (salt:hash)')

      // Sign in with default verify
      let signinResult = await auth.password.signIn({
        request: new Request('http://test.example.com/'),
        session,
        email: 'test@example.com',
        password: 'mypassword',
      })

      assert.equal(signinResult.type, 'success', 'Expected login to succeed')
      assert.equal(signinResult.data.user.email, 'test@example.com')
    })

    it('uses custom hashPassword in password reset', async () => {
      let customHash = mock.fn(async (password: string) => `custom-hash:${password}`)

      let now = new Date()
      let db: MemoryDB = {
        authUser: [
          {
            id: '1',
            email: 'test@example.com',
          },
        ],
        authAccount: [
          {
            id: 'acc-1',
            userId: '1',
            strategy: 'password',
            accountId: 'test@example.com',
            passwordHash: 'old-hash',
            createdAt: now,
            updatedAt: now,
          },
        ],
        authVerification: [],
      }

      let auth = createAuthClient({
        secret: 'test-secret-key',
        storage: createMemoryStorageAdapter(db),
        rateLimit: { enabled: false },
        password: {
          enabled: true,
          algorithm: {
            hash: customHash,
            verify: async () => true, // Not used in this test
          },
        },
      })
      let session = createSession()

      // Get reset token (user already exists in setup)
      let tokenResult = await auth.password.getResetToken({
        email: 'test@example.com',
        request: new Request('http://test.example.com/'),
      })
      assert.equal(tokenResult.type, 'success', 'Expected getResetToken to succeed')

      let { token } = tokenResult.data

      // Reset password with token
      let resetResult = await auth.password.reset({
        session,
        token,
        newPassword: 'newpassword',
        request: new Request('http://test.example.com/'),
      })
      assert.equal(resetResult.type, 'success', 'Expected password reset to succeed')

      assert.equal(customHash.mock.callCount(), 1, 'Expected customHash to be called for reset')
      assert.deepEqual(customHash.mock.calls[0].arguments, ['newpassword'])

      // Verify the password was updated in account table
      let account = db.authAccount?.find((a) => a.userId === '1' && a.strategy === 'password')
      assert.equal(account?.passwordHash, 'custom-hash:newpassword')
    })
  })
})
