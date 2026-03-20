import { describe, it } from 'node:test'

import {
  type BuildAction,
  type Controller,
  createAction,
  createController,
} from './controller.ts'
import type { Middleware, MiddlewareContext } from './middleware.ts'
import { createContextKey } from './request-context.ts'
import { createRoutes as route } from './route-map.ts'
import { createRouter } from './router.ts'
import type { IsEqual } from './type-utils.ts'

function expectTypeEquality<_check extends true>() {}

const CurrentUser = createContextKey<{ id: string } | null>(null)
const CurrentRole = createContextKey<'viewer' | 'admin' | null>(null)

type RequireUserTransform = readonly [readonly [typeof CurrentUser, { id: string }]]

type SetRoleTransform<role extends 'viewer' | 'admin'> = readonly [
  readonly [typeof CurrentRole, role],
]

function requireUser(): Middleware<any, any, RequireUserTransform> {
  return async (context, next) => {
    context.set(CurrentUser, { id: 'user-1' })
    return next()
  }
}

function setRole<role extends 'viewer' | 'admin'>(role: role): Middleware<any, any, SetRoleTransform<role>> {
  return async (context, next) => {
    context.set(CurrentRole, role)
    return next()
  }
}

const routes = route({
  account: '/account/:accountId',
  admin: {
    dashboard: '/admin',
    member: '/admin/members/:memberId',
  },
})

const plainRouter = createRouter()
plainRouter.get('/public', context => {
  // @ts-expect-error - CurrentUser is nullable without middleware refinement
  context.get(CurrentUser).id

  return new Response('Public')
})

const appMiddleware = [requireUser(), setRole('viewer')] as const

type AppContext = MiddlewareContext<typeof appMiddleware>

const router = createRouter({ middleware: appMiddleware })

router.get(routes.account, context => {
  let user = context.get(CurrentUser)
  let role = context.get(CurrentRole)
  let accountId: string = context.params.accountId

  expectTypeEquality<IsEqual<typeof user, { id: string }>>()
  expectTypeEquality<IsEqual<typeof role, 'viewer'>>()

  return new Response(`${accountId}:${user.id}:${role}`)
})

const accountAction = createAction<typeof routes.account, AppContext>(routes.account, {
  action(context) {
    let user = context.get(CurrentUser)
    let role = context.get(CurrentRole)
    let accountId: string = context.params.accountId

    expectTypeEquality<IsEqual<typeof user, { id: string }>>()
    expectTypeEquality<IsEqual<typeof role, 'viewer'>>()

    return new Response(`${accountId}:${user.id}:${role}`)
  },
})

const adminController = createController<typeof routes.admin, AppContext>(routes.admin, {
  actions: {
    dashboard(context) {
      let user = context.get(CurrentUser)
      let role = context.get(CurrentRole)

      expectTypeEquality<IsEqual<typeof user, { id: string }>>()
      expectTypeEquality<IsEqual<typeof role, 'viewer'>>()

      return new Response(`${user.id}:${role}`)
    },
    member(context) {
      let user = context.get(CurrentUser)
      let role = context.get(CurrentRole)
      let memberId: string = context.params.memberId

      expectTypeEquality<IsEqual<typeof user, { id: string }>>()
      expectTypeEquality<IsEqual<typeof role, 'viewer'>>()

      return new Response(`${user.id}:${role}:${memberId}`)
    },
  },
})

const legacyAccountAction = {
  action(context) {
    let user = context.get(CurrentUser)
    let role = context.get(CurrentRole)
    let accountId: string = context.params.accountId

    expectTypeEquality<IsEqual<typeof user, { id: string }>>()
    expectTypeEquality<IsEqual<typeof role, 'viewer'>>()

    return new Response(`${accountId}:${user.id}:${role}`)
  },
} satisfies BuildAction<'GET', typeof routes.account, AppContext>

const legacyAdminController = {
  actions: {
    dashboard(context) {
      let user = context.get(CurrentUser)
      let role = context.get(CurrentRole)

      expectTypeEquality<IsEqual<typeof user, { id: string }>>()
      expectTypeEquality<IsEqual<typeof role, 'viewer'>>()

      return new Response(`${user.id}:${role}`)
    },
    member(context) {
      let user = context.get(CurrentUser)
      let role = context.get(CurrentRole)
      let memberId: string = context.params.memberId

      expectTypeEquality<IsEqual<typeof user, { id: string }>>()
      expectTypeEquality<IsEqual<typeof role, 'viewer'>>()

      return new Response(`${user.id}:${role}:${memberId}`)
    },
  },
} satisfies Controller<typeof routes.admin, AppContext>

router.get(routes.account, accountAction)
router.map(routes.admin, adminController)
router.get(routes.account, legacyAccountAction)
router.map(routes.admin, legacyAdminController)

void plainRouter
void router
void accountAction
void adminController
void legacyAccountAction
void legacyAdminController

describe('router type inference', () => {
  it('propagates router-global middleware into stored and inline handlers', () => {})
})
