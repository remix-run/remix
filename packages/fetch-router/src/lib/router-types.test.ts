import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createRoutes as route } from '@remix-run/routes'

import { createAction, createController, type Action, type Controller } from './controller.ts'
import type { ContextWithMiddleware, Middleware, MiddlewareContext } from './middleware.ts'
import { createContextKey, type ContextEntry, type ContextWithValue } from './request-context.ts'
import { createRouter } from './router.ts'
import type { IsEqual } from './type-utils.ts'

function expectTypeEquality<_check extends true>() {}

const CurrentUser = createContextKey<{ id: string } | null>(null)
const CurrentRole = createContextKey<'viewer' | 'admin' | null>(null)

type CurrentUserContextEntry = ContextEntry<typeof CurrentUser, { id: string }>

type RoleContextEntry<role extends 'viewer' | 'admin'> = ContextEntry<typeof CurrentRole, role>

type FormDataContextEntry = ContextEntry<typeof FormData, FormData>

function requireUser(): Middleware<CurrentUserContextEntry> {
  return async (context, next) => {
    context.set(CurrentUser, { id: 'user-1' })
    return next()
  }
}

function setRole<role extends 'viewer' | 'admin'>(role: role): Middleware<RoleContextEntry<role>> {
  return async (context, next) => {
    context.set(CurrentRole, role)
    return next()
  }
}

function setFormData(): Middleware<FormDataContextEntry> {
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

const appMiddleware = [requireUser(), setRole('viewer')] as const
type AppContext = MiddlewareContext<typeof appMiddleware>

declare module './router-types.ts' {
  interface RouterTypes {
    context: AppContext
  }
}

type AdminAppContext = ContextWithValue<AppContext, typeof CurrentRole, 'admin'>

const elevatedReportMiddleware = [setRole('admin')] as const
type ElevatedAppContext = ContextWithMiddleware<AppContext, typeof elevatedReportMiddleware>

describe('router type inference', () => {
  it('keeps context values optional when middleware has not provided them', async () => {
    let plainRouter = createRouter()

    plainRouter.get('/public', (context) => {
      if (false as boolean) {
        // @ts-expect-error - CurrentUser is nullable without middleware refinement
        void context.get(CurrentUser).id

        // @ts-expect-error - FormData is not available unless context has it
        context.get(FormData).get('name')
      }

      let optionalFormData = context.get(FormData)
      expectTypeEquality<IsEqual<typeof optionalFormData, FormData | undefined>>()

      if (optionalFormData != null) {
        expectTypeEquality<IsEqual<typeof optionalFormData, FormData>>()
      }

      return new Response('Public')
    })

    let response = await plainRouter.fetch('https://remix.run/public')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Public')
  })

  it('propagates router middleware context into route handlers', async () => {
    let router = createRouter({ middleware: appMiddleware })

    router.get(routes.account, (context) => {
      let user = context.get(CurrentUser)
      let role = context.get(CurrentRole)
      let accountId: string = context.params.accountId

      expectTypeEquality<IsEqual<typeof user, { id: string }>>()
      expectTypeEquality<IsEqual<typeof role, 'viewer'>>()

      return new Response(accountId + ':' + user.id + ':' + role)
    })

    let response = await router.fetch('https://remix.run/account/123')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), '123:user-1:viewer')
  })

  it('types constructor keys as available when middleware provides them', async () => {
    let formRouter = createRouter({ middleware: [setFormData()] as const })

    formRouter.post('/form', (context) => {
      let formData = context.get(FormData)

      expectTypeEquality<IsEqual<typeof formData, FormData>>()

      return new Response(String(formData.get('name') ?? ''))
    })

    let response = await formRouter.fetch('https://remix.run/form', { method: 'POST' })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), '')
  })

  it('types stored actions with route params and explicit app context', () => {
    let accountAction = {
      handler(context) {
        let user = context.get(CurrentUser)
        let role = context.get(CurrentRole)
        let accountId: string = context.params.accountId

        expectTypeEquality<IsEqual<typeof user, { id: string }>>()
        expectTypeEquality<IsEqual<typeof role, 'viewer'>>()

        return new Response(accountId + ':' + user.id + ':' + role)
      },
    } satisfies Action<typeof routes.account, AppContext>

    let reportAction = ((context) => {
      let user = context.get(CurrentUser)
      let role = context.get(CurrentRole)
      let reportId: string = context.params.reportId

      expectTypeEquality<IsEqual<typeof user, { id: string }>>()
      expectTypeEquality<IsEqual<typeof role, 'viewer'>>()

      return new Response(reportId + ':' + user.id + ':' + role)
    }) satisfies Action<typeof routes.reports, AppContext>

    void accountAction
    void reportAction
  })

  it('types controllers with route params and explicit app context', () => {
    let adminController = {
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

    let elevatedReportsController = {
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

    void adminController
    void elevatedReportsController
  })

  it('uses RouterTypes.context as the default builder context', () => {
    let accountAction = createAction(routes.account, {
      handler(context) {
        let user = context.get(CurrentUser)
        let role = context.get(CurrentRole)
        let accountId: string = context.params.accountId

        expectTypeEquality<IsEqual<typeof user, { id: string }>>()
        expectTypeEquality<IsEqual<typeof role, 'viewer'>>()

        return new Response(accountId + ':' + user.id + ':' + role)
      },
    })

    let adminController = createController(routes.admin, {
      actions: {
        dashboard(context) {
          let user = context.get(CurrentUser)
          let role = context.get(CurrentRole)

          expectTypeEquality<IsEqual<typeof user, { id: string }>>()
          expectTypeEquality<IsEqual<typeof role, 'viewer'>>()

          return new Response(user.id + ':' + role)
        },
        member(context) {
          let memberId: string = context.params.memberId
          return new Response(memberId)
        },
      },
    })

    void accountAction
    void adminController
  })

  it('lets explicit contexts describe local middleware results', () => {
    let elevatedReportAction = {
      handler(context) {
        let role = context.get(CurrentRole)
        let reportId: string = context.params.reportId
        let exactRole: 'admin' = role

        void reportId
        void exactRole

        return new Response(role)
      },
    } satisfies Action<typeof routes.reports, AdminAppContext>

    let elevatedReportActionWithMiddleware = createAction<
      typeof routes.reports,
      ElevatedAppContext
    >(routes.reports, {
      middleware: elevatedReportMiddleware,
      handler(context) {
        let role = context.get(CurrentRole)
        let reportId: string = context.params.reportId
        let exactRole: 'admin' = role

        void reportId
        void exactRole

        return new Response(role)
      },
    })

    let elevatedReportsControllerWithMiddleware = createController<
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

    function checkMiddlewareContextBase(context: ElevatedAppContext): void {
      let user = context.get(CurrentUser)
      let role = context.get(CurrentRole)
      let exactRole: 'admin' = role

      expectTypeEquality<IsEqual<typeof user, { id: string }>>()

      void exactRole
    }

    void elevatedReportAction
    void elevatedReportActionWithMiddleware
    void elevatedReportsControllerWithMiddleware
    void checkMiddlewareContextBase
  })

  it('does not infer local middleware into handler context without an explicit context', () => {
    let untypedElevatedReportAction = createAction(routes.reports, {
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

    let untypedElevatedReportsController = createController(
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

    void untypedElevatedReportAction
    void untypedElevatedReportsController
  })

  it('rejects route maps and context contracts that do not line up', () => {
    let accountAction = {
      handler(context) {
        return new Response(context.params.accountId)
      },
    } satisfies Action<typeof routes.account, AppContext>

    let adminController = {
      actions: {
        dashboard() {
          return new Response('Dashboard')
        },
        member(context) {
          return new Response(context.params.memberId)
        },
      },
    } satisfies Controller<typeof routes.admin, AppContext>

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

      let functionAction: Action<typeof routes.reports, AppContext> = (context) =>
        new Response(context.params.reportId)

      let router = createRouter({ middleware: appMiddleware })

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
      void functionAction
      void controllerWithUntypedMiddleware
    }

    void accountAction
    void adminController
  })
})
