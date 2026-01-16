import * as assert from 'node:assert/strict'
import test, { describe } from 'node:test'
import * as Rank from './rank.ts'

// todo tests:
// - hostname
//   - edge cases:
//     - back-to-back variables
//     - back-to-back wildcards
// - pathname
//   - edge cases:
//     - back-to-back variables
//     - back-to-back wildcards
// - search
//   - exact value > any value
//   - any value > key only
//   - more constraints win

function rank(args: Partial<Rank.Type>): Rank.Type {
  return {
    hostname: args.hostname ?? [],
    pathname: args.pathname ?? [],
    search: args.search ?? new Map(),
  }
}

describe('rank', () => {
  describe('compare', () => {
    function assertCompare(
      url: URL | string,
      a: Partial<Rank.Type>,
      b: Partial<Rank.Type>,
      expected: -1 | 0 | 1,
    ) {
      url = typeof url === 'string' ? new URL(url) : url
      assert.equal(Rank.compare(url, rank(a), rank(b)), expected)
    }

    describe('hostname', () => {
      test('static vs variable', () => {
        assertCompare(
          'https://example.com',
          //       0123456789
          { hostname: [] },
          { hostname: [{ type: ':', begin: 0, end: 7 }] },
          -1,
        )
      })

      test('variable vs wildcard', () => {
        assertCompare(
          'https://example.com',
          { hostname: [{ type: ':', begin: 0, end: 7 }] },
          { hostname: [{ type: '*', begin: 0, end: 7 }] },
          -1,
        )
      })

      test('variable vs variable (same range = tie)', () => {
        assertCompare(
          'https://example.com',
          { hostname: [{ type: ':', begin: 0, end: 7 }] },
          { hostname: [{ type: ':', begin: 0, end: 7 }] },
          0,
        )
      })

      test('wildcard vs wildcard (same range = tie)', () => {
        assertCompare(
          'https://example.com',
          { hostname: [{ type: '*', begin: 0, end: 7 }] },
          { hostname: [{ type: '*', begin: 0, end: 7 }] },
          0,
        )
      })

      test('variable with prefix and suffix', () => {
        assertCompare(
          'https://example.com',
          { hostname: [{ type: ':', begin: 1, end: 6 }] },
          { hostname: [{ type: ':', begin: 0, end: 7 }] },
          -1,
        )
      })

      // todo:
      // URL = a.b-xxx.yyy-c.d , (a) pattern = a.*b-c.d vs (b) pattern = a.b-*c.d
      // a wins because the static `-c` suffix differs first (semantically) compared to `b-` prefix

      test('wildcard with prefix and suffix', () => {
        assertCompare(
          'https://example.com',
          { hostname: [{ type: '*', begin: 1, end: 6 }] },
          { hostname: [{ type: '*', begin: 0, end: 7 }] },
          -1,
        )
      })

      test('tie on variables and wildcards, break tie eventually', () => {
        assertCompare(
          'https://ab.cd.ef.gh.com',
          //       0123456789 1
          {
            hostname: [
              { type: '*', begin: 0, end: 5 },
              { type: ':', begin: 6, end: 8 },
              { type: '*', begin: 10, end: 11 },
            ],
          },
          {
            hostname: [
              { type: '*', begin: 0, end: 5 },
              { type: ':', begin: 6, end: 8 },
              { type: '*', begin: 9, end: 11 },
            ],
          },
          -1,
        )
      })
    })

    describe('pathname', () => {
      test('static vs variable', () => {
        assertCompare(
          'https://example.com/posts/123',
          { pathname: [] },
          { pathname: [{ type: ':', begin: 0, end: 3 }] },
          -1,
        )
      })

      test('variable vs wildcard', () => {
        assertCompare(
          'https://example.com/posts/123',
          { pathname: [{ type: ':', begin: 0, end: 3 }] },
          { pathname: [{ type: '*', begin: 0, end: 3 }] },
          -1,
        )
      })

      test('variable vs variable (same range = tie)', () => {
        assertCompare(
          'https://example.com/posts/123',
          { pathname: [{ type: ':', begin: 0, end: 3 }] },
          { pathname: [{ type: ':', begin: 0, end: 3 }] },
          0,
        )
      })

      test('wildcard vs wildcard (same range = tie)', () => {
        assertCompare(
          'https://example.com/posts/123',
          { pathname: [{ type: '*', begin: 0, end: 3 }] },
          { pathname: [{ type: '*', begin: 0, end: 3 }] },
          0,
        )
      })

      test('variable with prefix and suffix', () => {
        assertCompare(
          'https://example.com/posts/123',
          { pathname: [{ type: ':', begin: 1, end: 6 }] },
          { pathname: [{ type: ':', begin: 0, end: 3 }] },
          -1,
        )
      })

      test('wildcard with prefix and suffix', () => {
        assertCompare(
          'https://example.com/posts/123',
          { pathname: [{ type: '*', begin: 1, end: 6 }] },
          { pathname: [{ type: '*', begin: 0, end: 3 }] },
          -1,
        )
      })

      test('tie on variables and wildcards, break tie eventually', () => {
        assertCompare(
          'https://example.com/posts/123/456/789',
          {
            pathname: [
              { type: '*', begin: 0, end: 3 },
              { type: ':', begin: 4, end: 7 },
              { type: '*', begin: 9, end: 11 },
            ],
          },
          {
            pathname: [
              { type: '*', begin: 0, end: 3 },
              { type: ':', begin: 4, end: 7 },
              { type: '*', begin: 8, end: 11 },
            ],
          },
          -1,
        )
      })
    })

    describe('search', () => {
      test('exact value > any value', () => {
        assertCompare(
          'https://example.com/posts?q=hello',
          { search: new Map([['q', new Set(['hello'])]]) },
          { search: new Map([['q', new Set()]]) },
          -1,
        )
      })

      test('any value > key only', () => {
        assertCompare(
          'https://example.com/posts?q=hello',
          { search: new Map([['q', new Set()]]) },
          { search: new Map([['q', null]]) },
          -1,
        )
      })

      test('more constraints win', () => {
        assertCompare(
          'https://example.com/posts?q=hello&a=1',
          {
            search: new Map([
              ['q', null],
              ['a', null],
            ]),
          },
          { search: new Map([['q', null]]) },
          -1,
        )
      })

      test('tie on different keys (same count)', () => {
        assertCompare(
          'https://example.com/posts?q=hello&a=1',
          { search: new Map([['q', null]]) },
          { search: new Map([['a', null]]) },
          0,
        )
      })

      test('multiple exact values > single any value', () => {
        assertCompare(
          'https://example.com/posts?q=hello&q=world',
          { search: new Map([['q', new Set(['hello', 'world'])]]) },
          { search: new Map([['q', new Set()]]) },
          -1,
        )
      })
    })
  })
})
