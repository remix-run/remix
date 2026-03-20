import { describe, it } from 'node:test'

import { createAction, createController } from './controller.ts'
import type { Middleware } from './middleware.ts'
import { createContextKey } from './request-context.ts'
import type { RequestContext, SetContextValue } from './request-context.ts'
import { createRoutes as route } from './route-map.ts'
import { createRouter } from './router.ts'
import type { IsEqual } from './type-utils.ts'

function expectTypeEquality<_check extends true>() {}

const CurrentUser = createContextKey<{ id: string } | null>(null)

type RequireUserTransform = <context extends RequestContext<any, any>>(
  context: context,
) => SetContextValue<context, typeof CurrentUser, { id: string }>

function requireUser(): Middleware<any, any, RequireUserTransform> {
  return async (context, next) => {
    context.set(CurrentUser, { id: 'user-1' })
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

const router = createRouter()

router.get(routes.account, {
  middleware: [requireUser()],
  action(context) {
    let user = context.get(CurrentUser)
    let accountId: string = context.params.accountId

    expectTypeEquality<IsEqual<typeof user, { id: string }>>()

    void accountId

    return new Response(user.id)
  },
})

router.get('/public', context => {
  // @ts-expect-error - CurrentUser is nullable without middleware refinement
  context.get(CurrentUser).id

  return new Response('Public')
})

const accountAction = createAction(routes.account, {
  middleware: [requireUser()],
  action(context) {
    let user = context.get(CurrentUser)
    let accountId: string = context.params.accountId

    expectTypeEquality<IsEqual<typeof user, { id: string }>>()

    return new Response(`${accountId}:${user.id}`)
  },
})

const adminController = createController(routes.admin, {
  middleware: [requireUser()],
  actions: {
    dashboard(context) {
      let user = context.get(CurrentUser)

      expectTypeEquality<IsEqual<typeof user, { id: string }>>()

      return new Response(user.id)
    },
    member(context) {
      let user = context.get(CurrentUser)
      let memberId: string = context.params.memberId

      expectTypeEquality<IsEqual<typeof user, { id: string }>>()

      return new Response(`${user.id}:${memberId}`)
    },
  },
})

router.get(routes.account, accountAction)
router.map(routes.admin, adminController)

void router
void accountAction
void adminController

describe('router type inference', () => {
  it('applies middleware refinements to inline routes and helpers', () => {})
})
