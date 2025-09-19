import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createHrefBuilder } from './href.ts'

describe('createHrefBuilder', () => {
  it('creates a href builder', () => {
    let href = createHrefBuilder()
    assert.equal(href('/users/:id', { id: 'hi' }), '/users/hi')
  })

  it('works with a route stub', () => {
    let href = createHrefBuilder()
    assert.equal(href({ method: 'GET', pattern: '/users/:id' }, { id: 'hi' }), '/users/hi')
  })
})
