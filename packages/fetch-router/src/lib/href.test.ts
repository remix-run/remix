import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { RoutePattern } from '@remix-run/route-pattern'

import type { Assert, IsEqual } from '../type-utils.d.ts'
import { createHrefBuilder } from './href.ts'
import type { HrefBuilder } from './href.ts'

describe('createHrefBuilder', () => {
  it('works with a string', () => {
    let pattern = '/users/:id'
    let href = createHrefBuilder()
    assert.equal(href(pattern, { id: 'hi' }), '/users/hi')
  })

  it('works with a route pattern', () => {
    let pattern = new RoutePattern('/users/:id')
    let href = createHrefBuilder()
    assert.equal(href(pattern, { id: 'hi' }), '/users/hi')
  })

  it('works with a route stub', () => {
    let routes = {
      users: {
        show: { method: 'GET', pattern: '/users/:id' },
      },
    } as const

    let href = createHrefBuilder()
    assert.equal(href(routes.users.show, { id: 'hi' }), '/users/hi')
  })
})

type Tests = [
  Assert<IsEqual<'/users(/:id)' extends Parameters<HrefBuilder<'/users(/:id)'>>[0] ? 1 : 0, 1>>,
  Assert<IsEqual<'/users/:id' extends Parameters<HrefBuilder<'/users(/:id)'>>[0] ? 1 : 0, 1>>,
  Assert<IsEqual<'/users' extends Parameters<HrefBuilder<'/users(/:id)'>>[0] ? 1 : 0, 1>>,

  Assert<IsEqual<'invalid' extends Parameters<HrefBuilder<'/users(/:id)'>>[0] ? 1 : 0, 0>>,
]
