import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createRoutes as route } from '../routes.ts'
import { createAction, createController, type Action, type Controller } from './controller.ts'
import { createMiddleware, type Middleware, type MiddlewareContext } from './middleware.ts'
import {
  createContextKey,
  type ContextWithEntry,
  type RequestContext,
  type RequestRouter,
} from './request-context.ts'
import { createRouter, type RouteBuilder, type RouteInstaller, type RouterContext } from './router.ts'
import type { IsEqual } from './type-utils.ts'

function expectTypeEquality<_check extends true>() {}

const CurrentUser = createContextKey<{ id: string } | null>(null)
const CurrentRole = createContextKey<'viewer' | 'admin' | null>(null)
const currentUserContextProperty = { property: 'currentUser' } as const
const currentRoleContextProperty = { property: 'role' } as const

function requireUser(): Middleware<{
  key: typeof CurrentUser
  value: { id: string }
  property: 'currentUser'
}> {
  return async (context, next) => {
    context.set(CurrentUser, { id: 'user-1' }, currentUserContextProperty)
    return next()
  }
}

function setRole<role extends 'viewer' | 'admin'>(
  role: role,
): Middleware<{ key: typeof CurrentRole; value: role; property: 'role' }> {
  return async (context, next) => {
    context.set(CurrentRole, role, currentRoleContextProperty)
    return next()
  }
}

function loadAdminRole() {
  return setRole('admin')
}

function setFormData(): Middleware<{ key: typeof FormData; value: FormData }> {
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

function createAppRouter() {
  return createRouter({ middleware: [requireUser(), setRole('viewer')] })
}

type AppContext = RouterContext<ReturnType<typeof createAppRouter>>

declare module './router-types.ts' {
  interface RouterTypes {
    context: AppContext
  }
}

type AdminAppContext = ContextWithEntry<
  AppContext,
  { key: typeof CurrentRole; value: 'admin'; property: 'role' }
>

const elevatedReportMiddleware = createMiddleware(setRole('admin'))
type ElevatedAppContext = MiddlewareContext<typeof elevatedReportMiddleware, AppContext>

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
    let router = createAppRouter()

    router.get(routes.account, (context) => {
      let user = context.get(CurrentUser)
      let role = context.get(CurrentRole)
      let accountId: string = context.params.accountId

      expectTypeEquality<IsEqual<typeof user, { id: string }>>()
      expectTypeEquality<IsEqual<typeof role, 'viewer'>>()
      expectTypeEquality<IsEqual<typeof context.currentUser, { id: string }>>()
      expectTypeEquality<IsEqual<typeof context.role, 'viewer'>>()

      return new Response(accountId + ':' + context.currentUser.id + ':' + context.role)
    })

    let response = await router.fetch('https://remix.run/account/123')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), '123:user-1:viewer')
  })

  it('types constructor keys as available when middleware provides them', async () => {
    let formRouter = createRouter({ middleware: [setFormData()] })

    formRouter.post('/form', (context) => {
      let formData = context.get(FormData)

      expectTypeEquality<IsEqual<typeof formData, FormData>>()

      return new Response(String(formData.get('name') ?? ''))
    })

    let response = await formRouter.fetch('https://remix.run/form', { method: 'POST' })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), '')
  })

  it('derives app context from a router with inline middleware', () => {
    let router = createRouter({ middleware: [requireUser(), setRole('viewer')] })
    type DerivedContext = RouterContext<typeof router>

    function assertContext(context: DerivedContext) {
      let user = context.get(CurrentUser)
      let role = context.get(CurrentRole)

      expectTypeEquality<IsEqual<typeof user, { id: string }>>()
      expectTypeEquality<IsEqual<typeof role, 'viewer'>>()
      expectTypeEquality<IsEqual<typeof context.currentUser, { id: string }>>()
      expectTypeEquality<IsEqual<typeof context.role, 'viewer'>>()
    }

    void assertContext
  })

  it('derives context from middleware factory return types', () => {
    let factoryMiddleware = createMiddleware(requireUser(), loadAdminRole(), setFormData())

    type FactoryContext = MiddlewareContext<typeof factoryMiddleware>

    function assertContext(context: FactoryContext) {
      let user = context.get(CurrentUser)
      let role = context.get(CurrentRole)
      let formData = context.get(FormData)

      expectTypeEquality<IsEqual<typeof user, { id: string }>>()
      expectTypeEquality<IsEqual<typeof role, 'admin'>>()
      expectTypeEquality<IsEqual<typeof formData, FormData>>()
      expectTypeEquality<IsEqual<typeof context.currentUser, { id: string }>>()
      expectTypeEquality<IsEqual<typeof context.role, 'admin'>>()
    }

    void assertContext
    void factoryMiddleware
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

  it('infers action middleware results in stored action handlers', () => {
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

    let elevatedReportActionWithMiddleware = createAction(routes.reports, {
      middleware: createMiddleware(setRole('admin')),
      handler(context) {
        let user = context.get(CurrentUser)
        let role = context.get(CurrentRole)
        let reportId: string = context.params.reportId
        let exactRole: 'admin' = role

        expectTypeEquality<IsEqual<typeof user, { id: string }>>()
        expectTypeEquality<IsEqual<typeof role, 'admin'>>()
        expectTypeEquality<IsEqual<typeof context.role, 'admin'>>()

        void reportId
        void exactRole

        return new Response(role)
      },
    })

    void elevatedReportAction
    void elevatedReportActionWithMiddleware
  })

  it('infers action middleware results in direct route handlers', () => {
    let router = createAppRouter()

    router.get(routes.reports, {
      middleware: createMiddleware(setRole('admin')),
      handler(context) {
        let user = context.get(CurrentUser)
        let role = context.get(CurrentRole)
        let reportId: string = context.params.reportId
        let exactRole: 'admin' = role

        expectTypeEquality<IsEqual<typeof user, { id: string }>>()
        expectTypeEquality<IsEqual<typeof role, 'admin'>>()
        expectTypeEquality<IsEqual<typeof context.currentUser, { id: string }>>()
        expectTypeEquality<IsEqual<typeof context.role, 'admin'>>()

        void reportId
        void exactRole

        return new Response(role)
      },
    })

    router.route('GET', routes.reports, {
      middleware: createMiddleware(setRole('admin')),
      handler(context) {
        let role = context.get(CurrentRole)
        let reportId: string = context.params.reportId
        let exactRole: 'admin' = role

        expectTypeEquality<IsEqual<typeof context.role, 'admin'>>()

        void reportId
        void exactRole

        return new Response(role)
      },
    })

    router.map(routes.reports, {
      middleware: createMiddleware(setRole('admin')),
      handler(context) {
        let role = context.get(CurrentRole)
        let reportId: string = context.params.reportId
        let exactRole: 'admin' = role

        expectTypeEquality<IsEqual<typeof context.role, 'admin'>>()

        void reportId
        void exactRole

        return new Response(role)
      },
    })
  })

  it('infers controller middleware results in stored controller actions', () => {
    let elevatedReportsControllerWithMiddleware = createController(
      { reports: routes.reports },
      {
        middleware: createMiddleware(setRole('admin')),
        actions: {
          reports(context) {
            let user = context.get(CurrentUser)
            let role = context.get(CurrentRole)
            let reportId: string = context.params.reportId
            let exactRole: 'admin' = role

            expectTypeEquality<IsEqual<typeof user, { id: string }>>()
            expectTypeEquality<IsEqual<typeof role, 'admin'>>()
            expectTypeEquality<IsEqual<typeof context.role, 'admin'>>()

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

    void elevatedReportsControllerWithMiddleware
    void checkMiddlewareContextBase
  })

  it('keeps explicit context support for action and controller middleware results', () => {
    let elevatedReportAction = createAction<typeof routes.reports, ElevatedAppContext>(
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

    let elevatedReportsController = createController<
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

    void elevatedReportAction
    void elevatedReportsController
  })

  it('does not leak action middleware results into the base router context', () => {
    let elevatedReportAction = createAction(routes.reports, {
      middleware: createMiddleware(setRole('admin')),
      handler(context) {
        let role = context.get(CurrentRole)
        let reportId: string = context.params.reportId
        let exactRole: 'admin' = role

        void reportId
        void exactRole

        return new Response(role)
      },
    })

    let elevatedReportsController = createController(
      { reports: routes.reports },
      {
        middleware: createMiddleware(setRole('admin')),
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

    let router = createAppRouter()

    router.get(routes.reports, (context) => {
      // @ts-expect-error - route handlers still only see the router's base context
      let adminRole: 'admin' = context.get(CurrentRole)
      return new Response(adminRole)
    })

    void elevatedReportAction
    void elevatedReportsController
  })

  it('maps stored handlers that require less context than the router provides', () => {
    let publicReportAction = createAction<typeof routes.reports, RequestContext>(routes.reports, {
      handler(context) {
        let reportId: string = context.params.reportId

        return new Response(reportId)
      },
    })

    let publicAdminController = createController<typeof routes.admin, RequestContext>(
      routes.admin,
      {
        actions: {
          dashboard() {
            return new Response('Dashboard')
          },
          member(context) {
            let memberId: string = context.params.memberId

            return new Response(memberId)
          },
        },
      },
    )

    let router = createAppRouter()

    router.get(routes.reports, publicReportAction)
    router.route('GET', routes.reports, publicReportAction)
    router.map(routes.reports, publicReportAction)
    router.map(routes.admin, publicAdminController)

    void router
  })

  it('rejects stored handlers that require more context than the router provides', () => {
    let adminReportAction = createAction<typeof routes.reports, AdminAppContext>(routes.reports, {
      handler(context) {
        let exactRole: 'admin' = context.role
        return new Response(exactRole)
      },
    })

    let adminController = createController<typeof routes.admin, AdminAppContext>(routes.admin, {
      actions: {
        dashboard(context) {
          let exactRole: 'admin' = context.role
          return new Response(exactRole)
        },
        member(context) {
          let exactRole: 'admin' = context.role
          return new Response(context.params.memberId + ':' + exactRole)
        },
      },
    })

    if (false as boolean) {
      let plainRouter = createRouter()
      // @ts-expect-error - plain routers do not provide the admin context
      plainRouter.get(routes.reports, adminReportAction)
      // @ts-expect-error - plain routers do not provide the admin context
      plainRouter.route('GET', routes.reports, adminReportAction)
      // @ts-expect-error - plain routers do not provide the admin context
      plainRouter.map(routes.reports, adminReportAction)
      // @ts-expect-error - plain routers do not provide the admin context
      plainRouter.map(routes.admin, adminController)

      let appRouter = createAppRouter()
      // @ts-expect-error - the app router only provides the viewer role
      appRouter.get(routes.reports, adminReportAction)
      // @ts-expect-error - the app router only provides the viewer role
      appRouter.map(routes.admin, adminController)
    }

    void adminReportAction
    void adminController
  })

  it('exposes only request-time routing from request context', () => {
    let router = createAppRouter()

    router.get(routes.account, (context) => {
      let requestRouter: RequestRouter = context.router

      if (false as boolean) {
        // @ts-expect-error - request-time router references do not register routes
        context.router.get('/nested', () => new Response('Nested'))
        // @ts-expect-error - request-time router references do not mount route installers
        context.router.mount('/nested', () => {})
      }

      void requestRouter
      return new Response(context.params.accountId)
    })
  })

  it('types mounted route installers with the parent router context', async () => {
    let accountRoutes = route({
      index: '/',
      show: '/:accountId',
    })

    function installAccountRoutes<context extends AppContext>(router: RouteBuilder<context>) {
      router.get(accountRoutes.index, (context) => {
        let user = context.get(CurrentUser)
        let role = context.get(CurrentRole)

        expectTypeEquality<IsEqual<typeof user, { id: string }>>()
        expectTypeEquality<IsEqual<typeof role, 'viewer'>>()
        expectTypeEquality<IsEqual<typeof context.currentUser, { id: string }>>()
        expectTypeEquality<IsEqual<typeof context.role, 'viewer'>>()

        if (false as boolean) {
          // @ts-expect-error - route installers receive builders, not dispatching routers
          void router.fetch
        }

        return new Response(context.currentUser.id + ':' + context.role)
      })

      router.get(accountRoutes.show, (context) => {
        let accountId: string = context.params.accountId
        let user = context.get(CurrentUser)
        let role = context.get(CurrentRole)

        expectTypeEquality<IsEqual<typeof user, { id: string }>>()
        expectTypeEquality<IsEqual<typeof role, 'viewer'>>()

        return new Response(accountId + ':' + user.id + ':' + role)
      })
    }

    let router = createAppRouter()
    router.mount('/accounts', installAccountRoutes)

    let indexResponse = await router.fetch('https://remix.run/accounts')
    assert.equal(indexResponse.status, 200)
    assert.equal(await indexResponse.text(), 'user-1:viewer')

    let showResponse = await router.fetch('https://remix.run/accounts/123')
    assert.equal(showResponse.status, 200)
    assert.equal(await showResponse.text(), '123:user-1:viewer')
  })

  it('types mount pattern params in mounted route installers', async () => {
    let projectRoutes = route({
      index: '/',
      show: '/projects/:projectId',
      duplicate: '/duplicate/:orgId',
    })

    let router = createAppRouter()

    router.mount('/orgs/:orgId', (org) => {
      org.get(projectRoutes.index, (context) => {
        let orgId: string = context.params.orgId
        let user = context.get(CurrentUser)

        expectTypeEquality<IsEqual<typeof user, { id: string }>>()

        return new Response(orgId + ':' + user.id)
      })

      org.get(projectRoutes.show, (context) => {
        let orgId: string = context.params.orgId
        let projectId: string = context.params.projectId

        return new Response(orgId + ':' + projectId)
      })

      org.get(projectRoutes.duplicate, (context) => {
        let orgId: string = context.params.orgId

        return new Response(orgId)
      })

      org.get('/optional(/:orgId)', (context) => {
        let orgId: string = context.params.orgId

        return new Response(orgId)
      })
    })

    let indexResponse = await router.fetch('https://remix.run/orgs/acme')
    assert.equal(indexResponse.status, 200)
    assert.equal(await indexResponse.text(), 'acme:user-1')

    let showResponse = await router.fetch('https://remix.run/orgs/acme/projects/p123')
    assert.equal(showResponse.status, 200)
    assert.equal(await showResponse.text(), 'acme:p123')

    let duplicateResponse = await router.fetch('https://remix.run/orgs/acme/duplicate/child')
    assert.equal(duplicateResponse.status, 200)
    assert.equal(await duplicateResponse.text(), 'child')

    let optionalMountResponse = await router.fetch('https://remix.run/orgs/acme/optional')
    assert.equal(optionalMountResponse.status, 200)
    assert.equal(await optionalMountResponse.text(), 'acme')

    let optionalChildResponse = await router.fetch('https://remix.run/orgs/acme/optional/child')
    assert.equal(optionalChildResponse.status, 200)
    assert.equal(await optionalChildResponse.text(), 'child')
  })

  it('rejects installers that require context the parent router does not provide', () => {
    function installAccountRoutes<context extends AppContext>(router: RouteBuilder<context>) {
      router.get('/', (context) => new Response(context.currentUser.id))
    }

    function installAdminRoutes<context extends AdminAppContext>(router: RouteBuilder<context>) {
      router.get('/', (context) => {
        let role = context.get(CurrentRole)
        let exactRole: 'admin' = role

        return new Response(exactRole)
      })
    }

    if (false as boolean) {
      let plainRouter = createRouter()
      // @ts-expect-error - plain routers do not provide the app middleware context
      plainRouter.mount('/accounts', installAccountRoutes)

      let appRouter = createAppRouter()
      // @ts-expect-error - app routers provide a viewer role, not an admin role
      appRouter.mount('/admin', installAdminRoutes)
    }

    void installAccountRoutes
    void installAdminRoutes
  })

  it('checks concrete route installer context requirements', () => {
    let installBaseRoutes: RouteInstaller<AppContext> = (router) => {
      router.get('/', (context) => new Response(context.currentUser.id))
    }

    let installAdminRoutes: RouteInstaller<AdminAppContext> = (router) => {
      router.get('/', (context) => {
        let exactRole: 'admin' = context.role
        return new Response(exactRole)
      })
    }

    let appRouter = createAppRouter()
    appRouter.mount('/base', installBaseRoutes)

    let adminRouter = createRouter<AdminAppContext>()
    adminRouter.mount('/admin', installAdminRoutes)

    if (false as boolean) {
      let plainRouter = createRouter()
      // @ts-expect-error - concrete installers keep their required context
      plainRouter.mount('/base', installBaseRoutes)

      // @ts-expect-error - the app router only provides the viewer role
      appRouter.mount('/admin', installAdminRoutes)
    }
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

      let router = createAppRouter()

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
              let adminRole: 'admin' = context.get(CurrentRole)
              expectTypeEquality<IsEqual<typeof context.role, 'admin'>>()
              return new Response(adminRole)
            },
          },
        },
      )

      let controllerWithUntypedMiddleware = {
        middleware: elevatedReportMiddleware,
        actions: {
          reports(context) {
            // @ts-expect-error - controller context must include values provided by controller middleware
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
