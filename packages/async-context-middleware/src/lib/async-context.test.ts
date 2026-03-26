import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createContextKey,
  createRouter,
  type AnyParams,
  type MergeContext,
  type RequestContext,
} from '@remix-run/fetch-router'
import { route } from '@remix-run/fetch-router/routes'

import { asyncContext, getContext } from './async-context.ts'

const CurrentUser = createContextKey<unknown>()

declare module './async-context.ts' {
  interface AsyncContextTypes {
    requestContext: MergeContext<
      RequestContext<AnyParams>,
      [readonly [typeof CurrentUser, { id: string }]]
    >
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

  // @ts-expect-error Property 'missing' does not exist on type '{ id: string }'
  void user.missing
}
