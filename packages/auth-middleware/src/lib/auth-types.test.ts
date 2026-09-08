import { describe, it } from '@remix-run/test'

import {
  createAction,
  createController,
  createMiddleware,
  createRouter,
  type GetContextValue,
  type MiddlewareContext,
} from '@remix-run/fetch-router'
import { route } from '@remix-run/fetch-router/routes'

import { Auth, auth, type AuthState, type GoodAuth } from './auth.ts'
import { requireAuth } from './require-auth.ts'
import { createAPIAuthScheme } from './schemes/api-key.ts'
import { createBearerTokenAuthScheme } from './schemes/bearer.ts'

type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

function expectTypeEquality<_check extends true>() {}

const personalAccessToken = createBearerTokenAuthScheme({
  name: 'pat',
  verify(_token): { kind: 'bearer'; id: string } | null {
    return { kind: 'bearer', id: 'user-1' }
  },
})

const partnerKey = createAPIAuthScheme({
  name: 'partner-key',
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

const routerMiddleware = createMiddleware(typedAuth)
const protectedMiddleware = createMiddleware(requireAuth<APIIdentity>())

type AppContext = MiddlewareContext<typeof routerMiddleware>
type ProtectedAppContext = MiddlewareContext<typeof protectedMiddleware, AppContext>

type AuthContext = MiddlewareContext<typeof routerMiddleware>

const router = createRouter({ middleware: routerMiddleware })
const fallbackRouter = createRouter()

expectTypeEquality<IsEqual<typeof personalAccessToken.name, string>>()
expectTypeEquality<IsEqual<typeof partnerKey.name, string>>()
expectTypeEquality<IsEqual<GetContextValue<AuthContext, typeof Auth>, AuthState<APIIdentity>>>()
expectTypeEquality<
  IsEqual<GetContextValue<ProtectedAppContext, typeof Auth>, GoodAuth<APIIdentity>>
>()

router.get(routes.public, (context) => {
  let currentAuth = context.get(Auth)
  let directAuth = context.auth
  let id: string = context.params.id

  let authState: AuthState<APIIdentity> = currentAuth
  let directAuthState: AuthState<APIIdentity> = directAuth

  void id
  void authState
  void directAuthState

  // @ts-expect-error - auth must be narrowed before reading identity
  void currentAuth.identity
  // @ts-expect-error - auth must be narrowed before reading identity
  void directAuth.identity

  if (currentAuth.ok) {
    let identity: APIIdentity = currentAuth.identity
    let method: string = currentAuth.method

    void identity
    void method
  }

  if (directAuth.ok) {
    let identity: APIIdentity = directAuth.identity
    let method: string = directAuth.method

    void identity
    void method
  }

  return new Response('Public')
})

const privateAction = createAction(routes.private, {
  middleware: protectedMiddleware,
  handler(context) {
    let currentAuth = context.get(Auth)
    let directAuth = context.auth
    let id: string = context.params.id

    let authState: GoodAuth<APIIdentity> = currentAuth
    let directAuthState: GoodAuth<APIIdentity> = directAuth
    let method: string = currentAuth.method
    let directMethod: string = directAuth.method

    void id
    void authState
    void directAuthState
    void method
    void directMethod

    return new Response('Private')
  },
})

const adminController = createController(routes.admin, {
  middleware: protectedMiddleware,
  actions: {
    dashboard(context) {
      let currentAuth = context.get(Auth)
      let directAuth = context.auth

      let authState: GoodAuth<APIIdentity> = currentAuth
      let directAuthState: GoodAuth<APIIdentity> = directAuth
      let method: string = currentAuth.method
      let directMethod: string = directAuth.method

      void authState
      void directAuthState
      void method
      void directMethod

      return new Response('Admin')
    },
  },
})

type SessionIdentity = { kind: 'session'; id: string }
const sessionAuthMiddleware = createMiddleware(requireAuth<SessionIdentity>())
type SessionAuthContext = MiddlewareContext<typeof sessionAuthMiddleware>

const sessionAction = createAction('/session/:id', {
  middleware: sessionAuthMiddleware,
  handler(context) {
    let currentAuth = context.get(Auth)
    let directAuth = context.auth
    let id: string = context.params.id

    expectTypeEquality<IsEqual<typeof currentAuth, GoodAuth<{ kind: 'session'; id: string }>>>()
    expectTypeEquality<IsEqual<typeof directAuth, GoodAuth<{ kind: 'session'; id: string }>>>()
    expectTypeEquality<IsEqual<typeof currentAuth.method, string>>()
    expectTypeEquality<IsEqual<typeof directAuth.method, string>>()

    void id

    return new Response(directAuth.method)
  },
})

fallbackRouter.get('/session/:id', sessionAction)

router.get(routes.private, privateAction)

router.map(routes.admin, adminController)

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
void sessionAction

describe('auth middleware type inference', () => {
  it('propagates auth state into controller and action contracts', () => {})
})
