import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import {
  createContextKey,
  createRouter,
  type AnyParams,
  type ContextWithValues,
  type RequestContext,
} from '@remix-run/fetch-router'
import { route } from '@remix-run/routes'

import { asyncContext, getContext } from './async-context.ts'

const CurrentUser = createContextKey<unknown>()

type AppContext = ContextWithValues<
  RequestContext,
  [readonly [typeof CurrentUser, { id: string }]]
>

declare module '@remix-run/fetch-router' {
  interface RouterTypes {
    context: AppContext
  }
}

describe('asyncContext', () => {
  it('stores the request context in AsyncLocalStorage', async () => {
    let routes = route({
      home: '/',
    })

    let router = createRouter({
      middleware: [asyncContext()],
    })

    router.map(routes.home, (context) => {
      assert.equal(context, getContext())
      return new Response('Home')
    })

    await router.fetch('https://remix.run')
  })
})

if (false as boolean) {
  let user = getContext().get(CurrentUser)
  void user.id
  let param: string = getContext().params.anything
  void param

  // @ts-expect-error Property 'missing' does not exist on type '{ id: string }'
  void user.missing
}
