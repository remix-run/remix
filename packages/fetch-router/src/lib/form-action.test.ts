import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createFormAction } from './form-action.ts'
import { Route } from './route-map.ts'
import type { Assert, IsEqual } from './type-utils.ts'

describe('createFormAction', () => {
  it('creates an route map with index and action routes', () => {
    let login = createFormAction('login')

    type T = [
      Assert<
        IsEqual<
          typeof login,
          {
            index: Route<'GET', '/login'>
            action: Route<'POST', '/login'>
          }
        >
      >,
    ]

    assert.deepEqual(login.index, new Route('GET', '/login'))
    assert.deepEqual(login.action, new Route('POST', '/login'))
  })
})
