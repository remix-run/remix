import { describe, it } from '@remix-run/test'
import { createRoutes as route } from '@remix-run/routes'

import { createAction, createController, type Action, type Controller } from './controller.ts'
import type { ContextWithMiddleware, Middleware } from './middleware.ts'
import { createContextKey, type RequestContext, type ContextWithValue } from './request-context.ts'
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

type SetFormDataTransform = readonly [readonly [typeof FormData, FormData]]

function requireUser(): Middleware<RequireUserTransform> {
  return async (context, next) => {
    context.set(CurrentUser, { id: 'user-1' })
    return next()
  }
}

function setRole<role extends 'viewer' | 'admin'>(role: role): Middleware<SetRoleTransform<role>> {
  return async (context, next) => {
    context.set(CurrentRole, role)
    return next()
  }
}

function setFormData(): Middleware<SetFormDataTransform> {
  return async (context, next) => {
    context.set(FormData, new FormData())
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

  // @ts-expect-error - FormData is not available unless context has it
  context.get(FormData).get('name')

  let optionalFormData = context.get(FormData)
  expectTypeEquality<IsEqual<typeof optionalFormData, FormData | undefined>>()

  if (optionalFormData != null) {
    expectTypeEquality<IsEqual<typeof optionalFormData, FormData>>()
  }

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

const formRouter = createRouter({ middleware: [setFormData()] as const })

formRouter.post('/form', (context) => {
  let formData = context.get(FormData)

  expectTypeEquality<IsEqual<typeof formData, FormData>>()

  return new Response(String(formData.get('name') ?? ''))
})

type AppContext =
  typeof router extends Router<infer context extends RequestContext<any, any>> ? context : never

declare module './request-context.ts' {
  interface RouterTypes {
    context: AppContext
  }
}

type AdminAppContext = ContextWithValue<AppContext, typeof CurrentRole, 'admin'>

const accountAction = {
  handler(context) {
    let user = context.get(CurrentUser)
    let role = context.get(CurrentRole)
    let accountId: string = context.params.accountId

    expectTypeEquality<IsEqual<typeof user, { id: string }>>()
    expectTypeEquality<IsEqual<typeof role, 'viewer'>>()

    return new Response(accountId + ':' + user.id + ':' + role)
  },
} satisfies Action<typeof routes.account, AppContext>

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
} satisfies Action<typeof routes.reports, AdminAppContext>

const elevatedReportMiddleware = [setRole('admin')] as const
type ElevatedAppContext = ContextWithMiddleware<AppContext, typeof elevatedReportMiddleware>

function checkMiddlewareContextBase(context: ElevatedAppContext): void {
  let user = context.get(CurrentUser)
  let role = context.get(CurrentRole)
  let exactRole: 'admin' = role

  expectTypeEquality<IsEqual<typeof user, { id: string }>>()

  void exactRole
}

const elevatedReportActionWithMiddleware = createAction<typeof routes.reports, ElevatedAppContext>(
  routes.reports,
  {
    middleware: elevatedReportMiddleware,
    handler(context) {
      let role = context.get(CurrentRole)
      let reportId: string = context.params.reportId
      let exactRole: 'admin' = role

      void reportId
      void exactRole

      return new Response(role)
    },
  },
)

const elevatedReportsControllerWithMiddleware = createController<
  { reports: typeof routes.reports },
  ElevatedAppContext
>(
  { reports: routes.reports },
  {
    middleware: elevatedReportMiddleware,
    actions: {
      reports(context) {
        let role = context.get(CurrentRole)
        let reportId: string = context.params.reportId
        let exactRole: 'admin' = role

        void reportId
        void exactRole

        return new Response(role)
      },
    },
  },
)

const untypedElevatedReportAction = createAction(routes.reports, {
  middleware: elevatedReportMiddleware,
  handler(context) {
    let role = context.get(CurrentRole)
    let reportId: string = context.params.reportId
    // @ts-expect-error - local middleware context is not inferred into the handler
    let exactRole: 'admin' = role

    void reportId
    void exactRole

    return new Response(role)
  },
})

const untypedElevatedReportsController = createController(
  { reports: routes.reports },
  {
    middleware: elevatedReportMiddleware,
    actions: {
      reports(context) {
        let role = context.get(CurrentRole)
        let reportId: string = context.params.reportId
        // @ts-expect-error - local middleware context is not inferred into the handler
        let exactRole: 'admin' = role

        void reportId
        void exactRole

        return new Response(role)
      },
    },
  },
)

router.get(routes.account, accountAction)
router.get(routes.reports, elevatedReportActionWithMiddleware)
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

  router.map(
    { reports: routes.reports },
    {
      middleware: elevatedReportMiddleware,
      actions: {
        reports(context) {
          // @ts-expect-error - local middleware context is not inferred into the handler
          let adminRole: 'admin' = context.get(CurrentRole)
          return new Response(adminRole)
        },
      },
    },
  )

  let controllerWithUntypedMiddleware = {
    middleware: elevatedReportMiddleware,
    actions: {
      reports(context) {
        // @ts-expect-error - controller context must include values provided by local middleware
        let adminRole: 'admin' = context.get(CurrentRole)
        return new Response(adminRole)
      },
    },
  } satisfies Controller<{ reports: typeof routes.reports }, AppContext>

  void rootController
  void unknownActionController
  void controllerWithUntypedMiddleware
}

void plainRouter
void router
void formRouter
void accountAction
void adminController
void elevatedReportsController
void elevatedReportAction
void elevatedReportActionWithMiddleware
void elevatedReportsControllerWithMiddleware
void untypedElevatedReportAction
void untypedElevatedReportsController
void checkMiddlewareContextBase

describe('router type inference', () => {
  it('propagates router context into controller and action contracts', () => {})
})
