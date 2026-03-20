import { describe, it } from 'node:test'

import {
  createAction,
  createController,
  createRouter,
  type MiddlewareContext,
} from '@remix-run/fetch-router'
import { route } from '@remix-run/fetch-router/routes'

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

const router = createRouter({ middleware: routerMiddleware })
const fallbackRouter = createRouter()

expectTypeEquality<IsEqual<typeof personalAccessToken.name, 'pat'>>()
expectTypeEquality<IsEqual<typeof partnerKey.name, 'partner-key'>>()

router.get(routes.public, context => {
  let currentAuth = context.get(Auth)
  let id: string = context.params.id

  let authState: AuthState<
    APIIdentity,
    'pat' | 'partner-key'
  > = currentAuth

  void id
  void authState

  // @ts-expect-error - auth must be narrowed before reading identity
  currentAuth.identity

  if (currentAuth.ok) {
    let identity: APIIdentity =
      currentAuth.identity
    let method: 'pat' | 'partner-key' = currentAuth.method

    void identity
    void method
  }

  return new Response('Public')
})

const privateAction = createAction<typeof routes.private, AppContext>(routes.private, {
  action(context) {
    let currentAuth = context.get(Auth)
    let id: string = context.params.id

    let authState: AuthState<
      APIIdentity,
      'pat' | 'partner-key'
    > = currentAuth

    void id
    void authState

    return new Response('Private')
  },
})

const adminController = createController<typeof routes.admin, AppContext>(routes.admin, {
  actions: {
    dashboard(context) {
      let currentAuth = context.get(Auth)

      let authState: AuthState<
        APIIdentity,
        'pat' | 'partner-key'
      > = currentAuth

      void authState

      return new Response('Admin')
    },
  },
})

fallbackRouter.get('/session/:id', {
  middleware: [requireAuth<{ kind: 'session'; id: string }, 'session'>()] as const,
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

router.get(routes.private, privateAction)
router.map(routes.admin, adminController)

router.mount('/teams/:teamId', team => {
  team.get('/members/:memberId', context => {
    let currentAuth = context.get(Auth)
    let teamId: string = context.params.teamId
    let memberId: string = context.params.memberId

    let authState: AuthState<
      APIIdentity,
      'pat' | 'partner-key'
    > = currentAuth

    void authState
    void teamId
    void memberId

    return new Response('Team Member')
  })
})

const protectedMiddleware = [requireAuth<APIIdentity, 'pat' | 'partner-key'>()] as const
const protectedRouter = createRouter<AppContext, typeof protectedMiddleware>({
  middleware: protectedMiddleware,
})

protectedRouter.get('/settings/:sectionId', context => {
  let currentAuth = context.get(Auth)
  let sectionId: string = context.params.sectionId

  let authState: GoodAuth<
    APIIdentity,
    'pat' | 'partner-key'
  > = currentAuth
  let method: 'pat' | 'partner-key' = currentAuth.method

  void authState
  void method
  void sectionId

  return new Response(currentAuth.method)
})

router.mount('/private', protectedRouter)

void typedAuth
void router
void fallbackRouter
void privateAction
void adminController
void protectedRouter

describe('auth middleware type inference', () => {
  it('propagates router-global auth into mounted and stored handlers', () => {})
})
