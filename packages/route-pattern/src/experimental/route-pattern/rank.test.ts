import * as assert from 'node:assert/strict'
import test, { describe } from 'node:test'
import * as Rank from './rank.ts'
import { RoutePattern } from './route-pattern.ts'

describe('rank', () => {
  describe('compare', () => {
    function assertCompare(patterns: [string, string], url: URL | string, expected: -1 | 0 | 1) {
      url = typeof url === 'string' ? new URL(url) : url
      let a = RoutePattern.parse(patterns[0])
      let b = RoutePattern.parse(patterns[1])
      let matchA = a.match(url)
      let matchB = b.match(url)

      assert.notEqual(matchA, null, `Pattern A "${patterns[0]}" should match URL "${url}"`)
      assert.notEqual(matchB, null, `Pattern B "${patterns[1]}" should match URL "${url}"`)

      assert.equal(
        Rank.compare(url, { pattern: a, match: matchA!.meta }, { pattern: b, match: matchB!.meta }),
        expected,
      )
    }

    describe('hostname', () => {
      test('static vs variable', () => {
        assertCompare(['https://example.com', 'https://:subdomain.com'], 'https://example.com', -1)
      })

      test('variable vs wildcard', () => {
        assertCompare(['https://:subdomain.com', 'https://*.com'], 'https://example.com', -1)
      })

      test('variable vs variable (same range = tie)', () => {
        assertCompare(['https://:subdomain.com', 'https://:other.com'], 'https://example.com', 0)
      })

      test('wildcard vs wildcard (same range = tie)', () => {
        assertCompare(['https://*.com', 'https://*.com'], 'https://example.com', 0)
      })

      test('variable with prefix and suffix', () => {
        assertCompare(['https://e:sub.com', 'https://:subdomain.com'], 'https://example.com', -1)
      })

      test('wildcard with prefix and suffix', () => {
        assertCompare(['https://e*.com', 'https://*.com'], 'https://example.com', -1)
      })

      test('tie on variables and wildcards, break tie eventually', () => {
        assertCompare(
          ['https://*.cd.:ef.g*.com', 'https://*.cd.:ef.*.com'],
          'https://ab.cd.ef.gh.com',
          -1,
        )
      })

      test('rank segments right-to-left, but rank chars within segments left-to-right', () => {
        assertCompare(['https://a.*b-c.d', 'https://a.b-*c.d'], 'https://a.b-xxx.yyy-c.d', -1)
      })

      test('back-to-back variables with static content between', () => {
        assertCompare(['https://:a-:b.com', 'https://:sub.com'], 'https://ab-cd.com', -1)
      })

      test('back-to-back wildcards with static content between', () => {
        assertCompare(['https://*-*.com', 'https://*.com'], 'https://ab-cd.com', -1)
      })
    })

    describe('pathname', () => {
      test('static vs variable', () => {
        assertCompare(
          ['https://example.com/posts/123', 'https://example.com/posts/:id'],
          'https://example.com/posts/123',
          -1,
        )
      })

      test('variable vs wildcard', () => {
        assertCompare(
          ['https://example.com/posts/:id', 'https://example.com/posts/*'],
          'https://example.com/posts/123',
          -1,
        )
      })

      test('variable vs variable (same range = tie)', () => {
        assertCompare(
          ['https://example.com/posts/:id', 'https://example.com/posts/:other'],
          'https://example.com/posts/123',
          0,
        )
      })

      test('wildcard vs wildcard (same range = tie)', () => {
        assertCompare(
          ['https://example.com/posts/*', 'https://example.com/posts/*'],
          'https://example.com/posts/123',
          0,
        )
      })

      test('variable with prefix and suffix', () => {
        assertCompare(
          ['https://example.com/posts-:id', 'https://example.com/:segment'],
          'https://example.com/posts-123',
          -1,
        )
      })

      test('wildcard with prefix and suffix', () => {
        assertCompare(
          ['https://example.com/p*', 'https://example.com/*/:id'],
          'https://example.com/posts/123',
          -1,
        )
      })

      test('tie on variables and wildcards, break tie eventually', () => {
        assertCompare(
          ['https://example.com/*/123/:id/7*', 'https://example.com/*/123/:id/*'],
          'https://example.com/posts/123/456/789',
          -1,
        )
      })

      test('back-to-back variables with static content between', () => {
        assertCompare(
          ['https://example.com/:a/:b', 'https://example.com/*'],
          'https://example.com/posts/123',
          -1,
        )
      })

      test('back-to-back wildcards with static content between', () => {
        assertCompare(
          ['https://example.com/*/*', 'https://example.com/*'],
          'https://example.com/posts/123',
          -1,
        )
      })
    })

    describe('search', () => {
      test('exact value > any value', () => {
        assertCompare(
          ['https://example.com/posts?q=hello', 'https://example.com/posts?q'],
          'https://example.com/posts?q=hello',
          -1,
        )
      })

      test('any value > key only', () => {
        assertCompare(
          ['https://example.com/posts?q=', 'https://example.com/posts?q'],
          'https://example.com/posts?q=hello',
          -1,
        )
      })

      test('more constraints win', () => {
        assertCompare(
          ['https://example.com/posts?q=&a=', 'https://example.com/posts?q='],
          'https://example.com/posts?q=hello&a=1',
          -1,
        )
      })

      test('tie on different keys (same count)', () => {
        assertCompare(
          ['https://example.com/posts?q=', 'https://example.com/posts?a='],
          'https://example.com/posts?q=hello&a=1',
          0,
        )
      })

      test('multiple exact values > single any value', () => {
        assertCompare(
          ['https://example.com/posts?q=hello&q=world', 'https://example.com/posts?q'],
          'https://example.com/posts?q=hello&q=world',
          -1,
        )
      })

      test('exact values count more than any values', () => {
        assertCompare(
          ['https://example.com/posts?q=hello&a=1', 'https://example.com/posts?q&a'],
          'https://example.com/posts?q=hello&a=1&b=2',
          -1,
        )
      })
    })
  })
})
