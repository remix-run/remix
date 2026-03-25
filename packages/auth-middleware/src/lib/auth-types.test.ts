import { describe, it } from 'node:test'

import {
  createRouter,
  type BuildAction,
  type Controller,
  type GetContextValue,
  type MiddlewareContext,
  type RequestContext,
} from '@remix-run/fetch-router'
import { route } from '@remix-run/fetch-router/routes'

import {
  Auth,
  auth,
  type AuthState,
  type GoodAuth,
  type WithAuth,
  type WithRequiredAuth,
} from './auth.ts'
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

type APIIdentity = { kind: 'bearer'; id: string } | { kind: 'api-key'; id: number }

const typedAuth = auth<[typeof personalAccessToken, typeof partnerKey]>({
  schemes: [personalAccessToken, partnerKey],
})

const routes = route({
  public: '/public/:id',
  private: '/private/:id',
  admin: {
    dashboard: '/admin',
  },
})

const routerMiddleware = [typedAuth] as const

type AppContext = MiddlewareContext<typeof routerMiddleware>
type ProtectedAppContext = WithRequiredAuth<AppContext, APIIdentity>

type AuthContext = WithAuth<RequestContext, APIIdentity>

const router = createRouter({ middleware: routerMiddleware })
const fallbackRouter = createRouter()

expectTypeEquality<IsEqual<typeof personalAccessToken.name, 'pat'>>()
expectTypeEquality<IsEqual<typeof partnerKey.name, 'partner-key'>>()
expectTypeEquality<IsEqual<GetContextValue<AuthContext, typeof Auth>, AuthState<APIIdentity>>>()
expectTypeEquality<
  IsEqual<GetContextValue<ProtectedAppContext, typeof Auth>, GoodAuth<APIIdentity>>
>()

router.get(routes.public, (context) => {
  let currentAuth = context.get(Auth)
  let id: string = context.params.id

  let authState: AuthState<APIIdentity> = currentAuth

  void id
  void authState

  // @ts-expect-error - auth must be narrowed before reading identity
  void currentAuth.identity

  if (currentAuth.ok) {
    let identity: APIIdentity = currentAuth.identity
    let method: string = currentAuth.method

    void identity
    void method
  }

  return new Response('Public')
})

const privateAction = {
  handler(context) {
    let currentAuth = context.get(Auth)
    let id: string = context.params.id

    let authState: GoodAuth<APIIdentity> = currentAuth
    let method: string = currentAuth.method

    void id
    void authState
    void method

    return new Response('Private')
  },
} satisfies BuildAction<'GET', typeof routes.private, ProtectedAppContext>

const adminController = {
  actions: {
    dashboard(context) {
      let currentAuth = context.get(Auth)

      let authState: GoodAuth<APIIdentity> = currentAuth
      let method: string = currentAuth.method

      void authState
      void method

      return new Response('Admin')
    },
  },
} satisfies Controller<typeof routes.admin, ProtectedAppContext>

fallbackRouter.get('/session/:id', {
  middleware: [requireAuth<{ kind: 'session'; id: string }>()] as const,
  handler(context) {
    let currentAuth = context.get(Auth)
    let id: string = context.params.id

    expectTypeEquality<IsEqual<typeof currentAuth, GoodAuth<{ kind: 'session'; id: string }>>>()
    expectTypeEquality<IsEqual<typeof currentAuth.method, string>>()

    void id

    return new Response(currentAuth.method)
  },
})

router.get(routes.private, {
  middleware: [requireAuth<APIIdentity>()] as const,
  handler: privateAction.handler,
})

router.map(routes.admin, {
  middleware: [requireAuth<APIIdentity>()] as const,
  actions: adminController.actions,
})

if (false as boolean) {
  router.get(routes.private, (context) => {
    // @ts-expect-error - router-global auth() alone does not guarantee a good auth state
    let authState: GoodAuth<APIIdentity> = context.get(Auth)
    return new Response(authState.method)
  })
}

void typedAuth
void router
void fallbackRouter
void privateAction
void adminController

describe('auth middleware type inference', () => {
  it('propagates auth state into controller and action contracts', () => {})
})
