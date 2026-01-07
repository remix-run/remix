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
})
