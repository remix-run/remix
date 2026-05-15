import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import dedent from 'dedent'

import { HrefError } from './href.ts'
import { RoutePattern } from '../route-pattern.ts'

describe('HrefError', () => {
  describe('missing-hostname', () => {
    it('shows pattern', () => {
      let pattern = new RoutePattern('https://*:8080/api')
      let error = new HrefError({
        type: 'missing-hostname',
        pattern,
      })
      assert.equal(
        error.toString(),
        dedent`
          HrefError: pattern requires hostname

          Pattern: https://:8080/api
        `,
      )
    })
  })

  describe('missing-params', () => {
    it('shows missing param, pattern, and params', () => {
      let pattern = new RoutePattern('https://example.com/:collection/:id')
      let error = new HrefError({
        type: 'missing-params',
        pattern,
        partPattern: pattern.ast.pathname,
        missingParams: ['collection', 'id'],
        params: {},
      })
      assert.equal(
        error.toString(),
        dedent`
          HrefError: missing param(s): 'collection', 'id'

          Pattern: https://example.com/:collection/:id
          Params: {}
        `,
      )
    })
  })

  describe('nameless-wildcard', () => {
    it('shows error message with pattern', () => {
      let pattern = new RoutePattern('https://example.com/api/*/users')
      let error = new HrefError({
        type: 'nameless-wildcard',
        pattern,
      })
      assert.equal(
        error.toString(),
        dedent`
          HrefError: pattern contains nameless wildcard

          Pattern: https://example.com/api/*/users
        `,
      )
    })
  })
})
