import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import {
  createAction,
  createContextKey,
  createController,
  createRouter,
  type Middleware,
  type RouterContext,
} from 'remix/router'
import { route } from 'remix/routes'
import { asyncContext, getContext } from 'remix/middleware/async-context'

type IsEqual<left, right> =
  (<value>() => value extends left ? 1 : 2) extends <value>() => value extends right ? 1 : 2
    ? true
    : false

function expectTypeEquality<_check extends true>() {}

const Message = createContextKey<string>()

function loadMessage(): Middleware<{ key: typeof Message; value: string; property: 'message' }> {
  return async (context, next) => {
    context.set(Message, 'Hello', { property: 'message' })
    return next()
  }
}

const router = createRouter({ middleware: [loadMessage(), asyncContext()] })
type AppContext = RouterContext<typeof router>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}

const routes = route({ action: '/', controller: '/controller' })
const action = createAction(routes.action, (context) => {
  let asyncMessage = getContext().message

  expectTypeEquality<IsEqual<typeof context.message, string>>()
  expectTypeEquality<IsEqual<typeof asyncMessage, string>>()
  return new Response(context.message)
})
const controller = createController(routes, {
  actions: {
    action,
    controller(context) {
      expectTypeEquality<IsEqual<typeof context.message, string>>()
      return new Response(context.message)
    },
  },
})

router.map(routes, controller)

describe('RouterTypes', () => {
  it('configures the default router context through the remix module', async () => {
    let actionResponse = await router.fetch('https://remix.run/')
    let controllerResponse = await router.fetch('https://remix.run/controller')

    assert.equal(await actionResponse.text(), 'Hello')
    assert.equal(await controllerResponse.text(), 'Hello')
  })
})
