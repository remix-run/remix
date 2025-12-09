import * as assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { createAuthClient, type AuthClientConfig } from './client.ts'
import { createMemoryStorageAdapter, type MemoryDB } from './storage-adapters/memory.ts'
import { createSession } from '@remix-run/session'
import type { OAuthProvider } from './features/oauth/index.ts'

// Simple mock OAuth provider for testing
let mockGitHubProvider: OAuthProvider = {
  name: 'github',
  displayName: 'GitHub',
  getAuthorizationUrl: () => 'https://github.com/login/oauth/authorize',
  exchangeCodeForToken: async () => ({
    accessToken: 'mock-token',
  }),
  getUserProfile: async () => ({
    id: 'mock-user-id',
    email: 'oauth@example.com',
    name: 'Test User',
  }),
}

describe('Feature Hooks System', () => {
  test('onUserCreated hook is called for password signup', async () => {
    let hooksCalled: string[] = []

    let storage: MemoryDB = {}

    let authClient = createAuthClient({
      secret: 'test-secret-key',
      storage: createMemoryStorageAdapter(storage),
      hooks: {
        onUserCreated: (user) => {
          hooksCalled.push(`user-hook:${user.email}`)
        },
      },
      emailVerification: {
        enabled: true,
        sendVerification: ({ user, isNewUser }) => {
          hooksCalled.push(`verification:${user.email}:${isNewUser}`)
        },
      },
      password: {
        enabled: true,
      },
    })

    let session = createSession()
    let result = await authClient.password.signUp({
      request: new Request('http://localhost/'),
      session,
      email: 'test@example.com',
      password: 'password123',
    })

    assert.ok('user' in result)

    // Verify hooks were called in correct order
    assert.deepEqual(hooksCalled, [
      'verification:test@example.com:true', // Feature hook first
      'user-hook:test@example.com', // User hook second
    ])
  })

  test('onUserCreated hook is called for OAuth signup', async () => {
    let hooksCalled: string[] = []

    let config = {
      secret: 'test-secret-key',
      storage: createMemoryStorageAdapter(),
      hooks: {
        onUserCreated: (user) => {
          hooksCalled.push(`user-hook:${user.email}`)
        },
      },
      emailVerification: {
        enabled: true,
        sendVerification: ({ user, isNewUser }) => {
          hooksCalled.push(`verification:${user.email}:${isNewUser}`)
        },
      },
      oauth: {
        enabled: true,
        providers: {
          github: {
            provider: mockGitHubProvider,
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
          },
        },
        successURL: '/',
        errorURL: '/error',
      },
    } satisfies AuthClientConfig

    let authClient = createAuthClient(config)

    let session = createSession()
    let result = await authClient.oauth.signIn({
      request: new Request('http://localhost/'),
      session,
      provider: 'github',
      providerAccountId: '123',
      email: 'oauth@example.com',
      name: 'Test User',
    })

    assert.ok('type' in result)
    assert.equal(result.type, 'sign_up')

    // Verify hooks were called in correct order
    assert.deepEqual(hooksCalled, [
      'verification:oauth@example.com:true', // Feature hook first
      'user-hook:oauth@example.com', // User hook second
    ])
  })

  test('feature hooks run even without user hook', async () => {
    let verificationSent = false

    let authClient = createAuthClient({
      secret: 'test-secret-key',
      storage: createMemoryStorageAdapter(),
      emailVerification: {
        enabled: true,
        sendVerification: () => {
          verificationSent = true
        },
      },
      password: {
        enabled: true,
      },
    })

    let session = createSession()
    await authClient.password.signUp({
      request: new Request('http://localhost/'),
      session,
      email: 'test@example.com',
      password: 'password123',
    })

    assert.equal(verificationSent, true)
  })

  test('user hook runs even without feature hooks', async () => {
    let userHookCalled = false

    let authClient = createAuthClient({
      secret: 'test-secret-key',
      storage: createMemoryStorageAdapter(),
      hooks: {
        onUserCreated: () => {
          userHookCalled = true
        },
      },
      password: {
        enabled: true,
      },
    })

    let session = createSession()
    await authClient.password.signUp({
      request: new Request('http://localhost/'),
      session,
      email: 'test@example.com',
      password: 'password123',
    })

    assert.equal(userHookCalled, true)
  })

  test('onUserCreated hook NOT called for password signin', async () => {
    let hooksCalled = 0

    let authClient = createAuthClient({
      secret: 'test-secret-key',
      storage: createMemoryStorageAdapter(),
      hooks: {
        onUserCreated: () => {
          hooksCalled++
        },
      },
      password: {
        enabled: true,
      },
    })

    let session = createSession()

    // Sign up first
    await authClient.password.signUp({
      request: new Request('http://localhost/'),
      session,
      email: 'test@example.com',
      password: 'password123',
    })

    assert.equal(hooksCalled, 1)

    // Sign in - should NOT call hook again
    let session2 = createSession()
    await authClient.password.signIn({
      request: new Request('http://localhost/'),
      session: session2,
      email: 'test@example.com',
      password: 'password123',
    })

    assert.equal(hooksCalled, 1) // Still 1, not 2
  })

  test('onUserCreated hook NOT called for OAuth account linking', async () => {
    let hooksCalled = 0

    let config = {
      secret: 'test-secret-key',
      storage: createMemoryStorageAdapter(),
      hooks: {
        onUserCreated: () => {
          hooksCalled++
        },
      },
      password: {
        enabled: true,
      },
      oauth: {
        enabled: true,
        providers: {
          github: {
            provider: mockGitHubProvider,
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
          },
        },
        successURL: '/',
        errorURL: '/error',
      },
    } satisfies AuthClientConfig

    let authClient = createAuthClient(config)

    let session = createSession()

    // Create user with password
    await authClient.password.signUp({
      request: new Request('http://localhost/'),
      session,
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    })

    assert.equal(hooksCalled, 1)

    // Link OAuth account - should NOT call hook again
    let session2 = createSession()
    let result = await authClient.oauth.signIn({
      request: new Request('http://localhost/'),
      session: session2,
      provider: 'github',
      providerAccountId: '123',
      email: 'test@example.com', // Same email
      emailVerified: true, // Required for account linking
      name: 'Test User',
    })

    assert.ok('type' in result)
    assert.equal(result.type, 'account_linked')
    assert.equal(hooksCalled, 1) // Still 1, not 2
  })
})
