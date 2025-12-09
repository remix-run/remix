import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createRouter } from '@remix-run/fetch-router'
import { formData as formDataMiddleware } from '@remix-run/form-data-middleware'
import { session as sessionMiddleware } from '@remix-run/session-middleware'
import { createCookie } from '@remix-run/cookie'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { SetCookie } from '@remix-run/headers'
import { createAuthClient } from '@remix-run/auth'
import { createMemoryStorageAdapter } from '@remix-run/auth/storage-adapters/memory'
import { createAuthMiddleware } from './index.ts'

// Create a new request using the cookie in the given response
function createRequest(url: string, fromResponse?: Response): Request {
  let headers = new Headers()
  if (fromResponse) {
    let setCookie = fromResponse.headers.getSetCookie()
    if (setCookie.length > 0) {
      let cookie = new SetCookie(setCookie[0])
      headers.append('Cookie', `${cookie.name}=${cookie.value}`)
    }
  }
  return new Request(url, { headers })
}

describe('createAuthMiddleware', () => {
  it('pre-loads user from session', async () => {
    let sessionCookie = createCookie('session', { secrets: ['secret'] })
    let sessionStorage = createMemorySessionStorage()

    let authClient = createAuthClient({
      secret: 'test-secret-key',
      password: {
        enabled: true,
        sendReset: () => {},
      },
      storage: createMemoryStorageAdapter(),
    })

    // Create middleware and getUser from factory
    let { auth, getUser } = createAuthMiddleware(authClient)

    let router = createRouter({
      middleware: [formDataMiddleware(), sessionMiddleware(sessionCookie, sessionStorage), auth],
    })

    // Create signup route
    router.post('/signup', async ({ formData, session, request }) => {
      let email = formData.get('email') as string
      let password = formData.get('password') as string
      let result = await authClient.password.signUp({ request, session, email, password })
      if ('error' in result) return new Response(result.error, { status: 400 })
      return new Response('ok')
    })

    // Define route that uses getUser
    router.map('/', () => {
      let user = getUser()
      return new Response(`User: ${user?.email ?? 'null'}`)
    })

    // Sign up and get session
    let signupResponse = await router.fetch('https://remix.run/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'email=test@example.com&password=password123',
    })
    assert.equal(signupResponse.status, 200)

    // Use session from signup
    let response = await router.fetch(createRequest('https://remix.run', signupResponse))
    assert.equal(await response.text(), 'User: test@example.com')
  })

  it('returns null when not authenticated', async () => {
    let sessionCookie = createCookie('session', { secrets: ['secret'] })
    let sessionStorage = createMemorySessionStorage()

    let authClient = createAuthClient({
      secret: 'test-secret-key',
      password: {
        enabled: true,
        sendReset: () => {},
      },
      storage: createMemoryStorageAdapter(),
    })

    // Create middleware and getUser from factory
    let { auth, getUser } = createAuthMiddleware(authClient)

    let router = createRouter({
      middleware: [sessionMiddleware(sessionCookie, sessionStorage), auth],
    })

    router.map('/', () => {
      let user = getUser()
      return new Response(user ? 'authenticated' : 'anonymous')
    })

    let response = await router.fetch('https://remix.run')
    assert.equal(await response.text(), 'anonymous')
  })
})
