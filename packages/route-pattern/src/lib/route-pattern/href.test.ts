import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

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

  describe('missing-search-params', () => {
    it('shows single missing search param', () => {
      let pattern = new RoutePattern('https://example.com/search?q=')
      let error = new HrefError({
        type: 'missing-search-params',
        pattern,
        missingParams: ['q'],
        searchParams: {},
      })
      assert.equal(
        error.toString(),
        dedent`
          HrefError: missing required search param(s): 'q'

          Pattern: https://example.com/search?q=
          Search params: {}
        `,
      )
    })

    it('shows multiple missing search params', () => {
      let pattern = new RoutePattern('https://example.com/search?q=&sort=')
      let error = new HrefError({
        type: 'missing-search-params',
        pattern,
        missingParams: ['q', 'sort'],
        searchParams: { page: 1 },
      })
      assert.equal(
        error.toString(),
        dedent`
          HrefError: missing required search param(s): 'q', 'sort'

          Pattern: https://example.com/search?q=&sort=
          Search params: {"page":1}
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
