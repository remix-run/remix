import * as assert from 'node:assert/strict'
import test, { describe } from 'node:test'

import dedent from 'dedent'

import { HrefError, ParseError } from './errors.ts'
import { RoutePattern } from './route-pattern/route-pattern.ts'

describe('ParseError', () => {
  test('exposes type, source, and index properties', () => {
    let error = new ParseError('unmatched (', 'foo(bar', 3)
    assert.equal(error.type, 'unmatched (')
    assert.equal(error.source, 'foo(bar')
    assert.equal(error.index, 3)
  })

  test('shows caret under the problematic index', () => {
    let error = new ParseError('unmatched (', 'api/(v:major', 4)
    assert.equal(
      error.toString(),
      dedent`
        ParseError: unmatched (

        api/(v:major
            ^
      `,
    )
  })
})

describe('HrefError', () => {
  describe('missing-hostname', () => {
    test('shows error message with pattern', () => {
      let pattern = RoutePattern.parse('https://*:8080/api')
      let error = new HrefError({
        type: 'missing-hostname',
        pattern,
      })
      assert.equal(
        error.toString(),
        dedent`
          HrefError: pattern requires hostname

          https://*:8080/api
        `,
      )
    })
  })

  describe('missing-params', () => {
    test('shows missing param for single variant', () => {
      let pattern = RoutePattern.parse('https://example.com/:id')
      let error = new HrefError({
        type: 'missing-params',
        pattern,
        part: 'pathname',
        params: {},
      })
      assert.equal(
        error.toString(),
        dedent`
          HrefError: missing params for pathname

          Pattern: https://example.com/:id
          Params: {}
          Variants for pathname:
            - :id (missing: id)
        `,
      )
    })

    test('shows missing params across multiple variants', () => {
      let pattern = RoutePattern.parse('https://example.com/:a/:b(/:c)')
      let error = new HrefError({
        type: 'missing-params',
        pattern,
        part: 'pathname',
        params: { a: 'x' },
      })
      assert.equal(
        error.toString(),
        dedent`
          HrefError: missing params for pathname

          Pattern: https://example.com/:a/:b(/:c)
          Params: {"a":"x"}
          Variants for pathname:
            - :a/:b (missing: b)
            - :a/:b/:c (missing: b, c)
        `,
      )
    })

    test('shows missing dependent params', () => {
      let pattern = RoutePattern.parse('https://example.com/:a(:b)-:a(:c)')
      let error = new HrefError({
        type: 'missing-params',
        pattern,
        part: 'pathname',
        params: { b: 'thing' },
      })
      assert.equal(
        error.toString(),
        dedent`
          HrefError: missing params for pathname

          Pattern: https://example.com/:a(:b)-:a(:c)
          Params: {"b":"thing"}
          Variants for pathname:
            - :a-:a (missing: a)
            - :a-:a:c (missing: a, c)
            - :a:b-:a (missing: a)
            - :a:b-:a:c (missing: a, c)
        `,
      )
    })
  })

  describe('missing-search-params', () => {
    test('shows single missing search param', () => {
      let pattern = RoutePattern.parse('https://example.com/search?q=')
      let error = new HrefError({
        type: 'missing-search-params',
        pattern,
        missingParams: ['q'],
        searchParams: {},
      })
      assert.equal(
        error.toString(),
        dedent`
          HrefError: missing required search param(s) 'q'

          Pattern: https://example.com/search?q=
          Search params: {}
        `,
      )
    })

    test('shows multiple missing search params', () => {
      let pattern = RoutePattern.parse('https://example.com/search?q=&sort=')
      let error = new HrefError({
        type: 'missing-search-params',
        pattern,
        missingParams: ['q', 'sort'],
        searchParams: { page: 1 },
      })
      assert.equal(
        error.toString(),
        dedent`
          HrefError: missing required search param(s) 'q, sort'

          Pattern: https://example.com/search?q=&sort=
          Search params: {"page":1}
        `,
      )
    })
  })

  describe('nameless-wildcard', () => {
    test('shows error message with pattern', () => {
      let pattern = RoutePattern.parse('https://example.com/api/*/users')
      let error = new HrefError({
        type: 'nameless-wildcard',
        pattern,
      })
      assert.equal(
        error.toString(),
        dedent`
          HrefError: pattern contains nameless wildcard

          https://example.com/api/*/users
        `,
      )
    })
  })
})
