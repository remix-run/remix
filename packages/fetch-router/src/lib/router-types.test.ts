import { describe, it } from 'node:test'

import {
  type BuildAction,
  type Controller,
  createAction,
  createController,
} from './controller.ts'
import type { Middleware } from './middleware.ts'
import { createContextKey, type RequestContext } from './request-context.ts'
import { createRoutes as route } from './route-map.ts'
import { createRouter } from './router.ts'
import type { Router } from './router.ts'
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
const router = createRouter({ middleware: appMiddleware })

router.get(routes.account, context => {
  let user = context.get(CurrentUser)
  let role = context.get(CurrentRole)
  let accountId: string = context.params.accountId

  expectTypeEquality<IsEqual<typeof user, { id: string }>>()
  expectTypeEquality<IsEqual<typeof role, 'viewer'>>()

  return new Response(`${accountId}:${user.id}:${role}`)
})

router.mount('/orgs/:orgId', org => {
  org.get('/users/:userId', context => {
    let user = context.get(CurrentUser)
    let role = context.get(CurrentRole)
    let orgId: string = context.params.orgId
    let userId: string = context.params.userId

    expectTypeEquality<IsEqual<typeof user, { id: string }>>()
    expectTypeEquality<IsEqual<typeof role, 'viewer'>>()

    return new Response(`${orgId}:${userId}:${user.id}:${role}`)
  })
})

type AppContext = typeof router extends Router<
  infer context extends RequestContext<any, any>,
  any
>
  ? context
  : never

type RequiredUserContext = RequestContext<{}, [[typeof CurrentUser, { id: string }]]>

const profileRouter = createRouter<RequiredUserContext>()
profileRouter.get('/settings/:sectionId', context => {
  let user = context.get(CurrentUser)
  let sectionId: string = context.params.sectionId

  expectTypeEquality<IsEqual<typeof user, { id: string }>>()

  return new Response(`${sectionId}:${user.id}`)
})

router.mount('/profile', profileRouter)

const adminMiddleware = [setRole('admin')] as const
const adminRouter = createRouter<RequiredUserContext, typeof adminMiddleware>({
  middleware: adminMiddleware,
})
adminRouter.get('/members/:memberId', context => {
  let user = context.get(CurrentUser)
  let role = context.get(CurrentRole)
  let memberId: string = context.params.memberId

  expectTypeEquality<IsEqual<typeof user, { id: string }>>()
  let exactRole: 'admin' = role

  void exactRole

  return new Response(`${memberId}:${user.id}:${role}`)
})

router.mount('/admin', adminRouter)

if (false as boolean) {
  router.mount('/orgs/:orgId', org => {
    org.get('/users/:orgId', context => {
      // @ts-expect-error - duplicate param names are rejected across mounted routers
      context.params.orgId
      return new Response('duplicate')
    })
  })
}

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
void profileRouter
void adminRouter
void accountAction
void adminController
void legacyAccountAction
void legacyAdminController

describe('router type inference', () => {
  it('propagates router-global middleware into mounted and legacy handlers', () => {})
})
