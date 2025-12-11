import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAuthClient } from '@remix-run/auth'
import type { MemoryDB } from '@remix-run/auth/storage-adapters/memory'
import { createMemoryStorageAdapter } from '@remix-run/auth/storage-adapters/memory'
import { createFsStorageAdapter } from '@remix-run/auth/storage-adapters/fs'
import { createMemorySecondaryStorage } from '@remix-run/auth/secondary-storage/memory'
import { createFsSecondaryStorage } from '@remix-run/auth/secondary-storage/fs'
import { createGitHubOAuthProvider } from '@remix-run/auth/oauth-providers/github'
import { createMockOAuthProvider } from '../mock-oauth/provider.ts'
import { createMockOAuthHandlers } from '../mock-oauth/handlers.ts'
import { createAuthMiddleware } from '@remix-run/auth-middleware'
import { createCookie } from '@remix-run/cookie'
import { createFsSessionStorage } from '@remix-run/session/fs-storage'
import { createRedirectResponse } from '@remix-run/response/redirect'

import type { User } from '../models/users.ts'
import { sendEmail } from '../services/email.ts'
import { routes } from '../routes.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Shared memory storage for tests (allows direct inspection/manipulation)
export let authStorage: MemoryDB = {}

/**
 * Clear all data from auth storage (for tests)
 */
export function clearAuthStorage() {
  for (let key of Object.keys(authStorage)) {
    delete authStorage[key]
  }
}

// Use FS storage for dev (persists across restarts), memory for tests
let storage =
  process.env.NODE_ENV === 'test'
    ? createMemoryStorageAdapter(authStorage)
    : createFsStorageAdapter(path.resolve(__dirname, '..', '..', 'tmp', 'db', 'db.json'))

// Secondary storage for ephemeral data (rate limits, etc.)
// Use FS for dev (survives restarts), memory for tests
let secondaryStorage =
  process.env.NODE_ENV === 'test'
    ? createMemorySecondaryStorage()
    : createFsSecondaryStorage(path.resolve(__dirname, '..', '..', 'tmp', 'kv', 'kv.json'))

export let sessionCookie = createCookie('session', {
  httpOnly: true,
  path: '/',
  sameSite: 'Lax',
  secrets: ['s3cr3t'],
  secure: process.env.NODE_ENV === 'production',
})

export let sessionStorage = createFsSessionStorage(
  path.resolve(__dirname, '..', '..', 'tmp', 'sessions'),
)

// baseURL is required when using emailVerification because verification emails
// are sent during signup (via onUserCreated hook) which runs without request context
let baseURL = process.env.NODE_ENV === 'test' ? 'https://app.example.com' : 'http://localhost:44100'

export let authClient = createAuthClient({
  secret: process.env.AUTH_SECRET ?? 'demo-secret-key-DO-NOT-USE-IN-PRODUCTION',
  baseURL,
  authBasePath: '/api/auth',
  storage,
  secondaryStorage,
  // Trust x-forwarded-host/x-forwarded-proto headers for base URL inference
  trustProxyHeaders: true,
  // Rate limiting is enabled by default - disable in tests to avoid test pollution
  // ipAddressHeaders defaults to ['x-forwarded-for'] which our server injects
  rateLimit: {
    enabled: process.env.NODE_ENV !== 'test',
  },
  emailVerification: {
    enabled: true,
    successURL: routes.home.href(),
    errorURL: routes.auth.login.index.href(),
    sendVerification: ({ user, href, isNewUser }) => {
      sendEmail({
        to: user.email,
        subject: isNewUser ? 'Welcome! Verify your email' : 'Verify your email address',
        text: isNewUser
          ? `Hi ${user.name},\n\nWelcome to Auth Demo! Click the link below to verify your email and get started:\n\n${href}\n\nThis link will expire in 1 hour.`
          : `Hi ${user.name},\n\nClick the link below to verify your email address:\n\n${href}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, you can safely ignore this email.`,
      })
    },
    onVerified: (user) => {
      sendEmail({
        to: user.email,
        subject: "You're all set!",
        text: `Hi ${user.name},\n\nYour email has been verified! You're all set to use Auth Demo.\n\nGet started by exploring the community posts!`,
      })
    },
  },
  password: {
    enabled: true,
  },
  oauth: {
    enabled: true,
    providers: {
      github: createGitHubOAuthProvider({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        scopes: ['user:email'],
      }),
      // Mock OAuth provider for development and testing
      ...(process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
        ? {
            mock: createMockOAuthProvider({
              baseUrl:
                process.env.NODE_ENV === 'test'
                  ? 'https://app.example.com/mock-oauth' // Test mode
                  : 'http://localhost:44100/mock-oauth', // Dev mode
            }),
          }
        : {}),
    },
  },
})

// Create mock OAuth endpoint handlers for development and testing
export let mockOAuthEndpoints =
  process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
    ? createMockOAuthHandlers({
        profile: {
          id: 'dev-user-123',
          email: 'dev@example.com',
          emailVerified: true,
          name: 'Dev User',
        },
        showUI: process.env.NODE_ENV === 'development', // Show UI in dev, auto-approve in tests
      })
    : null

// Create typed middleware and getUser function
// The middleware automatically handles auth API routes at authClient.authBasePath
export let { auth, getUser } = createAuthMiddleware(authClient)

/**
 * Require authentication for a route.
 * Returns the authenticated user or redirects to login.
 *
 * @param url The request URL (for returnTo parameter)
 * @param redirectTo Optional custom login URL (defaults to /login)
 */
export function requireUser(
  url: URL,
  redirectTo: string = routes.auth.login.index.href(),
): User | Response {
  let user = getUser()
  if (!user) {
    return createRedirectResponse(
      redirectTo + `?returnTo=${encodeURIComponent(url.pathname + url.search)}`,
    )
  }
  return user
}
