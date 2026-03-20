import { describe, it } from 'node:test'

import { createRouter } from '@remix-run/fetch-router'

import { Auth, auth, type Auth as AuthState, type GoodAuth } from './auth.ts'
import { requireAuth } from './require-auth.ts'
import { createAPIAuthScheme } from './schemes/api-key.ts'
import { createBearerTokenAuthScheme } from './schemes/bearer.ts'

type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

function expectTypeEquality<_check extends true>() {}

const personalAccessToken = createBearerTokenAuthScheme({
  name: 'pat' as const,
  verify(_token): { kind: 'bearer'; id: string } | null {
    return { kind: 'bearer', id: 'user-1' }
  },
})

const partnerKey = createAPIAuthScheme({
  name: 'partner-key' as const,
  verify(_key): { kind: 'api-key'; id: number } | null {
    return { kind: 'api-key', id: 123 }
  },
})

const typedAuth = auth<[typeof personalAccessToken, typeof partnerKey]>({
  schemes: [personalAccessToken, partnerKey],
})
const router = createRouter()

expectTypeEquality<IsEqual<typeof personalAccessToken.name, 'pat'>>()
expectTypeEquality<IsEqual<typeof partnerKey.name, 'partner-key'>>()

router.get('/public/:id', {
  middleware: [typedAuth],
  action(context) {
    let currentAuth = context.get(Auth)
    let id: string = context.params.id

    let authState: AuthState<
      { kind: 'bearer'; id: string } | { kind: 'api-key'; id: number },
      'pat' | 'partner-key'
    > = currentAuth

    void id
    void authState

    // @ts-expect-error - auth must be narrowed before reading identity
    currentAuth.identity

    if (currentAuth.ok) {
      let identity: { kind: 'bearer'; id: string } | { kind: 'api-key'; id: number } =
        currentAuth.identity
      let method: 'pat' | 'partner-key' = currentAuth.method

      void identity
      void method
    }

    return new Response('Public')
  },
})

router.get('/private/:id', {
  middleware: [requireAuth<{ kind: 'session'; id: string }, 'session'>()],
  action(context) {
    let currentAuth = context.get(Auth)
    let id: string = context.params.id

    expectTypeEquality<
      IsEqual<typeof currentAuth, GoodAuth<{ kind: 'session'; id: string }, 'session'>>
    >()
    expectTypeEquality<IsEqual<typeof currentAuth.method, 'session'>>()

    void id

    return new Response(currentAuth.method)
  },
})

void typedAuth
void router

describe('auth middleware type inference', () => {
  it('narrows auth state through route-local middleware tuples', () => {})
})
