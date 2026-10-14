import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { SetCookie } from '@remix-run/headers/set-cookie'
import type { SessionStorage } from '@remix-run/session'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { session as sessionMiddleware } from '@remix-run/session-middleware'

import { finishPasskeyAuthentication } from '../finish-passkey-authentication.ts'
import type { PasskeyAuthenticationResult } from '../finish-passkey-authentication.ts'
import { finishPasskeyRegistration } from '../finish-passkey-registration.ts'
import type { PasskeyRegistrationResult } from '../finish-passkey-registration.ts'
import { createMemoryPasskeyChallengeStore } from '../memory-passkey-challenge-store.ts'
import { createPasskeyAuthProvider } from '../providers/passkey.ts'
import type {
  PasskeyAuthProvider,
  PasskeyAuthProviderOptions,
  PasskeyCredential,
} from '../providers/passkey.ts'
import { startPasskeyAuthentication } from '../start-passkey-authentication.ts'
import type { StartPasskeyAuthenticationOptions } from '../start-passkey-authentication.ts'
import { startPasskeyRegistration } from '../start-passkey-registration.ts'
import type { StartPasskeyRegistrationOptions } from '../start-passkey-registration.ts'
import type { PasskeyCreationOptionsJSON, PasskeyRequestOptionsJSON } from './json.ts'

export const testOrigin = 'https://app.example.com'
export const testUser = { id: 'user-1', name: 'user@example.com', displayName: 'Test User' }

export interface PasskeyTestAppOptions extends Partial<PasskeyAuthProviderOptions> {
  sessionStorage?: SessionStorage
}

export interface PasskeyTestApp {
  provider: PasskeyAuthProvider
  credentials: Map<string, PasskeyCredential>
  fetch(request: Request): Promise<Response>
  sessionCookie: string | undefined
  startRegistration(
    options?: Partial<StartPasskeyRegistrationOptions>,
  ): Promise<PasskeyCreationOptionsJSON>
  finishRegistration(
    response: unknown,
    options?: { userId?: string },
  ): Promise<PasskeyRegistrationResult>
  startAuthentication(
    options?: StartPasskeyAuthenticationOptions,
  ): Promise<PasskeyRequestOptionsJSON>
  finishAuthentication(response: unknown): Promise<PasskeyAuthenticationResult>
  readSession(): Promise<Record<string, unknown>>
}

// Creates a router with session middleware and passkey routes. Requests made through the returned
// helpers share one browser session cookie.
export function createPasskeyTestApp(options: PasskeyTestAppOptions = {}): PasskeyTestApp {
  let { sessionStorage = createMemorySessionStorage(), ...providerOptions } = options
  let credentials = new Map<string, PasskeyCredential>()
  let provider = createPasskeyAuthProvider({
    rpId: 'app.example.com',
    rpName: 'Example App',
    origin: testOrigin,
    challengeStore: createMemoryPasskeyChallengeStore(),
    findCredential: (credentialId) => credentials.get(credentialId) ?? null,
    ...providerOptions,
  })
  let router = createRouter({
    middleware: [
      sessionMiddleware(createCookie('__session', { secrets: ['secret1'] }), sessionStorage),
    ],
  })

  router.post('/registration/options', async (context) => {
    let options = (await context.request.json()) as Partial<StartPasskeyRegistrationOptions>
    return Response.json(
      await startPasskeyRegistration(provider, context, { user: testUser, ...options }),
    )
  })
  router.post('/registration', async (context) => {
    let body = (await context.request.json()) as { response: unknown; userId: string }
    return Response.json(await finishPasskeyRegistration(provider, context, body))
  })
  router.post('/authentication/options', async (context) => {
    let options = (await context.request.json()) as StartPasskeyAuthenticationOptions
    return Response.json(await startPasskeyAuthentication(provider, context, options))
  })
  router.post('/authentication', async (context) => {
    let body = (await context.request.json()) as { response: unknown }
    return Response.json(await finishPasskeyAuthentication(provider, context, body))
  })
  router.get('/session', (context) => Response.json(context.session.data[0]))

  let app: PasskeyTestApp = {
    provider,
    credentials,
    fetch: (request) => router.fetch(request),
    sessionCookie: undefined,
    startRegistration: (options = {}) => post('/registration/options', options),
    finishRegistration: (response, options = {}) =>
      post('/registration', { response, userId: testUser.id, ...options }),
    startAuthentication: (options = {}) => post('/authentication/options', options),
    finishAuthentication: (response) => post('/authentication', { response }),
    async readSession() {
      let response = await router.fetch(
        new Request(new URL('/session', testOrigin), {
          headers: app.sessionCookie ? { Cookie: app.sessionCookie } : undefined,
        }),
      )
      return (await response.json()) as Record<string, unknown>
    },
  }

  return app

  async function post<result>(path: string, body: unknown): Promise<result> {
    let response = await router.fetch(
      new Request(new URL(path, testOrigin), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(app.sessionCookie ? { Cookie: app.sessionCookie } : undefined),
        },
        body: JSON.stringify(body),
      }),
    )

    for (let header of response.headers.getSetCookie()) {
      let cookie = new SetCookie(header)
      app.sessionCookie = `${cookie.name}=${cookie.value}`
    }

    return (await response.json()) as result
  }
}
