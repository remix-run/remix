import * as assert from 'node:assert/strict'
import test, { describe } from 'node:test'
import { RoutePattern } from './route-pattern.ts'
import type { AST } from './ast.ts'

describe('RoutePattern', () => {
  describe('parse', () => {
    function assertParse(
      source: string,
      expected: { [K in Exclude<keyof AST, 'search'>]?: string } & {
        search?: Record<string, Array<string> | null>
      },
    ) {
      let pattern = RoutePattern.parse(source)
      let expectedSearch = new Map()
      if (expected.search) {
        for (let name in expected.search) {
          let value = expected.search[name]
          expectedSearch.set(name, value ? new Set(expected.search[name]) : null)
        }
      }
      assert.deepStrictEqual(
        {
          protocol: pattern.ast.protocol?.toString(),
          hostname: pattern.ast.hostname?.toString(),
          port: pattern.ast.port ?? null,
          pathname: pattern.ast.pathname?.toString(),
          search: pattern.ast.search,
        },
        {
          // explicitly set each prop so that we can omitted keys from `expected` to set them as defaults
          protocol: expected.protocol ?? '*',
          hostname: expected.hostname ?? '*',
          port: expected.port ?? null,
          pathname: expected.pathname ?? '',
          search: expectedSearch,
        },
      )
    }

    test('parses hostname', () => {
      assertParse('://example.com', { hostname: 'example.com' })
    })

    test('parses port', () => {
      assertParse('://example.com:8000', { hostname: 'example.com', port: '8000' })
    })

    test('parses pathname', () => {
      assertParse('products/:id', { pathname: 'products/:id' })
    })

    test('parses search', () => {
      assertParse('?q', { search: { q: null } })
      assertParse('?q=', { search: { q: [] } })
      assertParse('?q=1', { search: { q: ['1'] } })
    })

    test('parses protocol + hostname', () => {
      assertParse('https://example.com', {
        protocol: 'https',
        hostname: 'example.com',
      })
    })

    test('parses protocol + pathname', () => {
      assertParse('http:///dir/file', {
        protocol: 'http',
        pathname: 'dir/file',
      })
    })

    test('parses hostname + pathname', () => {
      assertParse('://example.com/about', {
        hostname: 'example.com',
        pathname: 'about',
      })
    })

    test('parses protocol + hostname + pathname', () => {
      assertParse('https://example.com/about', {
        protocol: 'https',
        hostname: 'example.com',
        pathname: 'about',
      })
    })

    test('parses protocol + hostname + search', () => {
      assertParse('https://example.com?q=1', {
        protocol: 'https',
        hostname: 'example.com',
        search: { q: ['1'] },
      })
    })

    test('parses protocol + pathname + search', () => {
      assertParse('http:///dir/file?q=1', {
        protocol: 'http',
        pathname: 'dir/file',
        search: { q: ['1'] },
      })
    })

    test('parses hostname + pathname + search', () => {
      assertParse('://example.com/about?q=1', {
        hostname: 'example.com',
        pathname: 'about',
        search: { q: ['1'] },
      })
    })

    test('parses protocol + hostname + pathname + search', () => {
      assertParse('https://example.com/about?q=1', {
        protocol: 'https',
        hostname: 'example.com',
        pathname: 'about',
        search: { q: ['1'] },
      })
    })

    test('parses search params into constraints grouped by param name', () => {
      assertParse('?q&q', { search: { q: null } })
      assertParse('?q&q=', { search: { q: [] } })
      assertParse('?q&q=1', { search: { q: ['1'] } })
      assertParse('?q=&q=1', { search: { q: ['1'] } })
      assertParse('?q=1&q=2', { search: { q: ['1', '2'] } })
      assertParse('?q&q=&q=1&q=2', { search: { q: ['1', '2'] } })
    })
  })

  describe('join', () => {
    function assertJoin(a: string, b: string, expected: string) {
      assert.deepStrictEqual(
        RoutePattern.parse(a).join(RoutePattern.parse(b)),
        RoutePattern.parse(expected),
      )
    }

    test('protocol', () => {
      assertJoin('http://', '*://', 'http://')
      assertJoin('*://', '*://', '*://')
      assertJoin('*://', 'http://', 'http://')

      assertJoin('http://', '*proto://', '*proto://')
      assertJoin('*proto://', 'http://', 'http://')
      assertJoin('*proto://', '*other://', '*other://')
      assertJoin('*://', '*proto://', '*proto://')

      assertJoin('http://', 'https://', 'https://')
      assertJoin('://example.com', 'https://', 'https://example.com')
      assertJoin('http://example.com', 'https://', 'https://example.com')
    })

    test('hostname', () => {
      assertJoin('://example.com', '://*', '://example.com')
      assertJoin('://*', '://*', '://*')
      assertJoin('://*', '://example.com', '://example.com')

      assertJoin('://example.com', '://*host', '://*host')
      assertJoin('://*host', '://example.com', '://example.com')
      assertJoin('://*host', '://*other', '://*other')
      assertJoin('://*', '://*host', '://*host')

      assertJoin('://example.com', '://other.com', '://other.com')
      assertJoin('://', '://other.com', '://other.com')
      assertJoin('http://example.com', '://other.com', 'http://other.com')
      assertJoin('://example.com/pathname', '://other.com', '://other.com/pathname')
      assertJoin('/pathname', '://other.com', '://other.com/pathname')
    })

    test('port', () => {
      assertJoin('://:8000', '://', '://:8000')
      assertJoin('://', '://:8000', '://:8000')
      assertJoin('://:8000', '://:3000', '://:3000')
      assertJoin('://example.com', '://example.com:8000', '://example.com:8000')
      assertJoin('http://example.com:4321', '://example.com:8000', 'http://example.com:8000')
    })

    test('pathname', () => {
      assertJoin('', '', '')
      assertJoin('', 'b', 'b')
      assertJoin('a', '', 'a')

      assertJoin('a', 'b', 'a/b')
      assertJoin('a/', 'b', 'a/b')
      assertJoin('a', '/b', 'a/b')
      assertJoin('a/', '/b', 'a/b')

      assertJoin('(a/)', 'b', '(a/)/b')
      assertJoin('(a/)', '/b', '(a/)/b')
      assertJoin('a', '(/b)', 'a/(/b)')
      assertJoin('a/', '(/b)', 'a/(/b)')

      assertJoin('(a/)', '(/b)', '(a/)/(/b)')
      assertJoin('((a/))', '((/b))', '((a/))/((/b))')
    })

    test('search', () => {
      assertJoin('path', '?a', 'path?a')
      assertJoin('?a', '?b=1', '?a&b=1')
      assertJoin('?a=1', '?b=2', '?a=1&b=2')
    })

    test('combos', () => {
      assertJoin('http://example.com/a', '*proto://*host/b', '*proto://*host/a/b')
      assertJoin('http://example.com:8000/a', 'https:///b', 'https://example.com:8000/a/b')
      assertJoin('http://example.com:8000/a', '://other.com/b', 'http://other.com:8000/a/b')

      assertJoin(
        'https://api.example.com:8000/v1/:resource',
        '/users/(admin/)posts?filter&sort=asc',
        'https://api.example.com:8000/v1/:resource/users/(admin/)posts?filter&sort=asc',
      )

      assertJoin(
        '*proto://example.com/base',
        '*proto://other.com/path',
        '*proto://other.com/base/path',
      )

      assertJoin(
        'http://old.com:3000/keep/this',
        'https://new.com:8080',
        'https://new.com:8080/keep/this',
      )

      assertJoin(
        'users/:id?tab=profile',
        'posts/:postId?sort=recent',
        'users/:id/posts/:postId?tab=profile&sort=recent',
      )

      assertJoin(
        '://(staging.)example.com/api(/:version)',
        '://*/resources/:id(.json)',
        '://(staging.)example.com/api(/:version)/resources/:id(.json)',
      )
    })
  })
})
