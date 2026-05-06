import { describe, it } from '@remix-run/test'
import { createRoutes as route } from '@remix-run/routes'

import type { BuildAction, Controller } from './controller.ts'
import type { Middleware } from './middleware.ts'
import { createContextKey, type RequestContext, type SetContextValue } from './request-context.ts'
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

function setRole<role extends 'viewer' | 'admin'>(
  role: role,
): Middleware<any, any, SetRoleTransform<role>> {
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
  reports: '/reports/:reportId',
})

const plainRouter = createRouter()
plainRouter.get('/public', (context) => {
  // @ts-expect-error - CurrentUser is nullable without middleware refinement
  void context.get(CurrentUser).id

  return new Response('Public')
})

const appMiddleware = [requireUser(), setRole('viewer')] as const
const router = createRouter({ middleware: appMiddleware })

router.get(routes.account, (context) => {
  let user = context.get(CurrentUser)
  let role = context.get(CurrentRole)
  let accountId: string = context.params.accountId

  expectTypeEquality<IsEqual<typeof user, { id: string }>>()
  expectTypeEquality<IsEqual<typeof role, 'viewer'>>()

  return new Response(accountId + ':' + user.id + ':' + role)
})

type AppContext =
  typeof router extends Router<infer context extends RequestContext<any, any>> ? context : never

type AdminAppContext = SetContextValue<AppContext, typeof CurrentRole, 'admin'>

const accountAction = {
  handler(context) {
    let user = context.get(CurrentUser)
    let role = context.get(CurrentRole)
    let accountId: string = context.params.accountId

    expectTypeEquality<IsEqual<typeof user, { id: string }>>()
    expectTypeEquality<IsEqual<typeof role, 'viewer'>>()

    return new Response(accountId + ':' + user.id + ':' + role)
  },
} satisfies BuildAction<'GET', typeof routes.account, AppContext>

const adminController = {
  actions: {
    dashboard(context) {
      let user = context.get(CurrentUser)
      let role = context.get(CurrentRole)

      expectTypeEquality<IsEqual<typeof user, { id: string }>>()
      expectTypeEquality<IsEqual<typeof role, 'viewer'>>()

      return new Response(user.id + ':' + role)
    },
    member(context) {
      let user = context.get(CurrentUser)
      let role = context.get(CurrentRole)
      let memberId: string = context.params.memberId

      expectTypeEquality<IsEqual<typeof user, { id: string }>>()
      expectTypeEquality<IsEqual<typeof role, 'viewer'>>()

      return new Response(user.id + ':' + role + ':' + memberId)
    },
  },
} satisfies Controller<typeof routes.admin, AppContext>

const elevatedReportsController = {
  actions: {
    reports(context) {
      let user = context.get(CurrentUser)
      let role = context.get(CurrentRole)
      let reportId: string = context.params.reportId
      let exactRole: 'admin' = role

      expectTypeEquality<IsEqual<typeof user, { id: string }>>()

      void exactRole

      return new Response(reportId + ':' + user.id + ':' + role)
    },
  },
} satisfies Controller<{ reports: typeof routes.reports }, AdminAppContext>

const elevatedReportAction = {
  handler(context) {
    let role = context.get(CurrentRole)
    let reportId: string = context.params.reportId
    let exactRole: 'admin' = role

    void reportId
    void exactRole

    return new Response(role)
  },
} satisfies BuildAction<'GET', typeof routes.reports, AdminAppContext>

router.get(routes.account, accountAction)
router.map(routes.admin, adminController)
if (false as boolean) {
  let rootController = {
    actions: {
      account: accountAction,
      reports(context) {
        let reportId: string = context.params.reportId
        return new Response(reportId)
      },
      // @ts-expect-error - nested route maps are mapped with their own controllers
      admin: adminController,
    },
  } satisfies Controller<typeof routes, AppContext>

  let unknownActionController = {
    actions: {
      dashboard() {
        return new Response('Dashboard')
      },
      member() {
        return new Response('Member')
      },
      // @ts-expect-error - controller action keys must exist in the route map
      missing() {
        return new Response('Missing')
      },
    },
  } satisfies Controller<typeof routes.admin, AppContext>

  router.get(routes.reports, (context) => {
    // @ts-expect-error - the base app context still only guarantees the inherited viewer role
    let adminRole: 'admin' = context.get(CurrentRole)
    return new Response(adminRole)
  })

  void rootController
  void unknownActionController
}

void plainRouter
void router
void accountAction
void adminController
void elevatedReportsController
void elevatedReportAction

describe('router type inference', () => {
  it('propagates router context into controller and action contracts', () => {})
})
