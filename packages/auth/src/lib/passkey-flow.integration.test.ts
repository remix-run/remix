import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { auth, Auth, createSessionAuthScheme, requireAuth } from '@remix-run/auth-middleware'
import type { GoodAuth } from '@remix-run/auth-middleware'
import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { SetCookie } from '@remix-run/headers/set-cookie'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { completeAuth } from './complete-auth.ts'
import { finishPasskeyAuthentication } from './finish-passkey-authentication.ts'
import { finishPasskeyRegistration } from './finish-passkey-registration.ts'
import { createMemoryPasskeyChallengeStore } from './memory-passkey-challenge-store.ts'
import { createTestAuthenticator } from './passkey/test-authenticator.ts'
import { createPasskeyAuthProvider } from './providers/passkey.ts'
import type { PasskeyCredential } from './providers/passkey.ts'
import { startPasskeyAuthentication } from './start-passkey-authentication.ts'
import { startPasskeyRegistration } from './start-passkey-registration.ts'

interface User {
  id: string
  email: string
}

describe('passkey flow integration', () => {
  it('adds a passkey to a signed-in account and signs in with it after logout', async () => {
    let users = new Map<string, User>([['user-1', { id: 'user-1', email: 'user@example.com' }]])
    let passkeys = new Map<string, PasskeyCredential>()
    let provider = createPasskeyAuthProvider({
      rpId: 'app.example.com',
      rpName: 'Example App',
      origin: 'https://app.example.com',
      challengeStore: createMemoryPasskeyChallengeStore(),
      findCredential: (credentialId) => passkeys.get(credentialId) ?? null,
    })
    let router = createRouter({
      middleware: [
        sessionMiddleware(
          createCookie('__session', { secrets: ['secret1'] }),
          createMemorySessionStorage(),
        ),
        auth({
          schemes: [
            createSessionAuthScheme({
              read(session) {
                return session.get('auth') as { userId: string } | null
              },
              verify(value) {
                return users.get(value.userId) ?? null
              },
              invalidate(session) {
                session.unset('auth')
              },
            }),
          ],
        }),
      ],
    })

    router.post('/login', (context) => {
      let session = completeAuth(context)
      session.set('auth', { userId: 'user-1' })
      return new Response(null, { status: 204 })
    })
    router.post('/logout', ({ session }) => {
      session.unset('auth')
      session.regenerateId(true)
      return new Response(null, { status: 204 })
    })
    router.post('/account/passkeys/options', {
      middleware: [requireAuth()],
      async handler(context) {
        let user = (context.get(Auth) as GoodAuth<User>).identity
        let excludeCredentials = [...passkeys.values()].filter(
          (passkey) => passkey.userId === user.id,
        )
        return Response.json(
          await startPasskeyRegistration(provider, context, {
            user: { id: user.id, name: user.email },
            excludeCredentials,
          }),
        )
      },
    })
    router.post('/account/passkeys', {
      middleware: [requireAuth()],
      async handler(context) {
        let user = (context.get(Auth) as GoodAuth<User>).identity
        let result = await finishPasskeyRegistration(provider, context, {
          response: await context.request.text(),
          userId: user.id,
        })
        if (!result.ok) {
          return Response.json(result.error, { status: 400 })
        }

        passkeys.set(result.credential.id, result.credential)
        return new Response(null, { status: 201 })
      },
    })
    router.post('/login/passkey/options', async (context) =>
      Response.json(await startPasskeyAuthentication(provider, context)),
    )
    router.post('/login/passkey', async (context) => {
      let result = await finishPasskeyAuthentication(provider, context, {
        response: await context.request.text(),
      })
      if (!result.ok) {
        return Response.json(result.error, { status: 401 })
      }

      passkeys.set(result.credential.id, result.credential)
      let session = completeAuth(context)
      session.set('auth', { userId: result.credential.userId })
      return new Response(null, { status: 204 })
    })
    router.get('/dashboard', {
      middleware: [requireAuth()],
      handler({ get }) {
        return Response.json(get(Auth))
      },
    })

    let cookie = ''
    async function send(method: 'GET' | 'POST', path: string, body?: string): Promise<Response> {
      let response = await router.fetch(
        new Request(`https://app.example.com${path}`, {
          method,
          headers: cookie ? { Cookie: cookie } : undefined,
          body,
        }),
      )
      for (let header of response.headers.getSetCookie()) {
        let setCookie = new SetCookie(header)
        cookie = `${setCookie.name}=${setCookie.value}`
      }
      return response
    }

    let authenticator = await createTestAuthenticator()

    assert.equal((await send('POST', '/login')).status, 204)

    let registrationOptions = await (await send('POST', '/account/passkeys/options')).json()
    let registrationResponse = await authenticator.register(registrationOptions)
    assert.equal(
      (await send('POST', '/account/passkeys', JSON.stringify(registrationResponse))).status,
      201,
    )
    assert.equal(passkeys.size, 1)

    let secondRegistrationOptions = await (await send('POST', '/account/passkeys/options')).json()
    assert.deepEqual(secondRegistrationOptions.excludeCredentials, [
      { id: authenticator.credentialId, type: 'public-key', transports: ['internal', 'hybrid'] },
    ])

    assert.equal((await send('POST', '/logout')).status, 204)
    assert.equal((await send('GET', '/dashboard')).status, 401)

    let authenticationOptions = await (await send('POST', '/login/passkey/options')).json()
    let cookieBeforeSignIn = cookie
    let authenticationResponse = await authenticator.authenticate(authenticationOptions)
    assert.equal(
      (await send('POST', '/login/passkey', JSON.stringify(authenticationResponse))).status,
      204,
    )
    assert.notEqual(cookie, cookieBeforeSignIn)

    let dashboardResponse = await send('GET', '/dashboard')
    assert.deepEqual(await dashboardResponse.json(), {
      ok: true,
      identity: { id: 'user-1', email: 'user@example.com' },
      method: 'session',
    })

    let staleSessionResponse = await router.fetch(
      new Request('https://app.example.com/dashboard', { headers: { Cookie: cookieBeforeSignIn } }),
    )
    assert.equal(staleSessionResponse.status, 401)

    assert.equal(
      (await send('POST', '/login/passkey', JSON.stringify(authenticationResponse))).status,
      401,
    )
  })
})
