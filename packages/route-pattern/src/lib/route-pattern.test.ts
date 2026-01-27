import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { RoutePattern } from './route-pattern.ts'
import type * as Search from './route-pattern/search.ts'
import { HrefError } from './errors.ts'

describe('RoutePattern', () => {
  describe('parse', () => {
    function assertParse(
      source: string,
      expected: { [K in Exclude<keyof RoutePattern['ast'], 'search'>]?: string } & {
        search?: Record<string, Array<string> | null>
      },
    ) {
      let pattern = new RoutePattern(source)
      let expectedSearch = new Map()
      if (expected.search) {
        for (let name in expected.search) {
          let value = expected.search[name]
          expectedSearch.set(name, value ? new Set(expected.search[name]) : null)
        }
      }
      assert.deepEqual(
        {
          protocol: pattern.ast.protocol,
          hostname: pattern.ast.hostname?.source,
          port: pattern.ast.port ?? null,
          pathname: pattern.ast.pathname?.source,
          search: pattern.ast.search,
        },
        {
          // explicitly set each prop so that we can omitted keys from `expected` to set them as defaults
          protocol: expected.protocol ?? null,
          hostname: expected.hostname,
          port: expected.port ?? null,
          pathname: expected.pathname ?? '',
          search: expectedSearch,
        },
      )
    }

    it('parses hostname', () => {
      assertParse('://example.com', { hostname: 'example.com' })
    })

    it('parses port', () => {
      assertParse('://example.com:8000', { hostname: 'example.com', port: '8000' })
    })

    it('parses pathname', () => {
      assertParse('products/:id', { pathname: 'products/:id' })
    })

    it('parses search', () => {
      assertParse('?q', { search: { q: null } })
      assertParse('?q=', { search: { q: [] } })
      assertParse('?q=1', { search: { q: ['1'] } })
    })

    it('parses protocol + hostname', () => {
      assertParse('https://example.com', {
        protocol: 'https',
        hostname: 'example.com',
      })
    })

    it('parses protocol + pathname', () => {
      assertParse('http:///dir/file', {
        protocol: 'http',
        pathname: 'dir/file',
      })
    })

    it('parses hostname + pathname', () => {
      assertParse('://example.com/about', {
        hostname: 'example.com',
        pathname: 'about',
      })
    })

    it('parses protocol + hostname + pathname', () => {
      assertParse('https://example.com/about', {
        protocol: 'https',
        hostname: 'example.com',
        pathname: 'about',
      })
    })

    it('parses protocol + hostname + search', () => {
      assertParse('https://example.com?q=1', {
        protocol: 'https',
        hostname: 'example.com',
        search: { q: ['1'] },
      })
    })

    it('parses protocol + pathname + search', () => {
      assertParse('http:///dir/file?q=1', {
        protocol: 'http',
        pathname: 'dir/file',
        search: { q: ['1'] },
      })
    })

    it('parses hostname + pathname + search', () => {
      assertParse('://example.com/about?q=1', {
        hostname: 'example.com',
        pathname: 'about',
        search: { q: ['1'] },
      })
    })

    it('parses protocol + hostname + pathname + search', () => {
      assertParse('https://example.com/about?q=1', {
        protocol: 'https',
        hostname: 'example.com',
        pathname: 'about',
        search: { q: ['1'] },
      })
    })

    it('parses search params into constraints grouped by param name', () => {
      assertParse('?q&q', { search: { q: null } })
      assertParse('?q&q=', { search: { q: [] } })
      assertParse('?q&q=1', { search: { q: ['1'] } })
      assertParse('?q=&q=1', { search: { q: ['1'] } })
      assertParse('?q=1&q=2', { search: { q: ['1', '2'] } })
      assertParse('?q&q=&q=1&q=2', { search: { q: ['1', '2'] } })
    })

    it('throws on invalid protocol', () => {
      assert.throws(() => new RoutePattern('ftp://example.com'), {
        name: 'ParseError',
        type: 'invalid protocol',
      })
      assert.throws(() => new RoutePattern('ws://example.com/path'), {
        name: 'ParseError',
        type: 'invalid protocol',
      })
      assert.throws(() => new RoutePattern('httpx://example.com'), {
        name: 'ParseError',
        type: 'invalid protocol',
      })
      assert.throws(() => new RoutePattern('http(s)x://example.com'), {
        name: 'ParseError',
        type: 'invalid protocol',
      })
    })
  })

  describe('part accessors', () => {
    it('returns protocol', () => {
      assert.equal(new RoutePattern('http://example.com').protocol, 'http')
      assert.equal(new RoutePattern('https://example.com').protocol, 'https')
      assert.equal(new RoutePattern('http(s)://example.com').protocol, 'http(s)')
      assert.equal(new RoutePattern('/pathname').protocol, '')
      assert.equal(new RoutePattern('://example.com').protocol, '')
    })

    it('returns hostname', () => {
      assert.equal(new RoutePattern('://example.com').hostname, 'example.com')
      assert.equal(new RoutePattern('://:host').hostname, ':host')
      assert.equal(new RoutePattern('://api.example.com').hostname, 'api.example.com')
      assert.equal(new RoutePattern('/pathname').hostname, '')
      assert.equal(new RoutePattern('http://').hostname, '')
    })

    it('returns port', () => {
      assert.equal(new RoutePattern('://example.com:8000').port, '8000')
      assert.equal(new RoutePattern('://example.com:3000').port, '3000')
      assert.equal(new RoutePattern('://example.com').port, '')
      assert.equal(new RoutePattern('/pathname').port, '')
    })

    it('returns pathname', () => {
      assert.equal(new RoutePattern('/posts/:id').pathname, 'posts/:id')
      assert.equal(new RoutePattern('posts/:id').pathname, 'posts/:id')
      assert.equal(new RoutePattern('/posts(/:id)').pathname, 'posts(/:id)')
      assert.equal(new RoutePattern('://example.com').pathname, '')
      assert.equal(new RoutePattern('/').pathname, '')
      assert.equal(new RoutePattern('').pathname, '')
    })

    it('returns search', () => {
      assert.equal(new RoutePattern('?q').search, 'q')
      assert.equal(new RoutePattern('?q=').search, 'q=')
      assert.equal(new RoutePattern('?q=1').search, 'q=1')
      assert.equal(new RoutePattern('?q=1&q=2').search, 'q=1&q=2')
      assert.equal(new RoutePattern('/posts?filter').search, 'filter')
      assert.equal(new RoutePattern('/posts?sort=asc').search, 'sort=asc')
      assert.equal(new RoutePattern('/posts').search, '')
      assert.equal(new RoutePattern('').search, '')
    })

    it('returns all parts together', () => {
      let pattern = new RoutePattern('https://api.example.com:8000/v1/:resource?filter=active')
      assert.equal(pattern.protocol, 'https')
      assert.equal(pattern.hostname, 'api.example.com')
      assert.equal(pattern.port, '8000')
      assert.equal(pattern.pathname, 'v1/:resource')
      assert.equal(pattern.search, 'filter=active')
    })
  })

  describe('source', () => {
    function assertSource(source: string, expected?: string) {
      assert.equal(new RoutePattern(source).source, expected ?? source)
    }

    it('reconstructs pathname only', () => {
      assertSource('/posts/:id')
      assertSource('posts/:id', '/posts/:id')
      assertSource('/posts(/:id)')
      assertSource('/', '/')
      assertSource('', '/')
    })

    it('reconstructs hostname only', () => {
      assertSource('://example.com', '://example.com/')
      assertSource('://:host', '://:host/')
    })

    it('reconstructs port', () => {
      assertSource('://example.com:8000', '://example.com:8000/')
      assertSource('://example.com:3000', '://example.com:3000/')
      assertSource('://:host:8080', '://:host:8080/')
    })

    it('reconstructs protocol', () => {
      assertSource('http://', 'http:///')
      assertSource('https://', 'https:///')
      assertSource('http(s)://', 'http(s):///')
    })

    it('reconstructs protocol + hostname', () => {
      assertSource('https://example.com', 'https://example.com/')
      assertSource('http://example.com', 'http://example.com/')
      assertSource('http(s)://*host', 'http(s)://*host/')
    })

    it('reconstructs protocol + hostname + pathname', () => {
      assertSource('https://example.com/about')
      assertSource('http://example.com/products/:id')
      assertSource('http(s)://*host/path')
    })

    it('reconstructs protocol + hostname + port + pathname', () => {
      assertSource('https://example.com:8000/about')
      assertSource('http://localhost:3000/posts/:id')
      assertSource('http(s)://example.com:8000/path')
    })

    it('reconstructs search params', () => {
      assertSource('?q', '/?q')
      assertSource('?q=', '/?q=')
      assertSource('?q=1', '/?q=1')
      assertSource('?q=1&q=2', '/?q=1&q=2')
      assertSource('/posts?filter')
      assertSource('/posts?sort=asc')
      assertSource('/posts?tag=foo&tag=bar')
      assertSource('https://example.com/posts?q=1')
    })

    it('reconstructs complex patterns with optionals', () => {
      assertSource('/posts(/:id)')
      assertSource('://(staging.)example.com', '://(staging.)example.com/')
      assertSource(
        '://(staging.)example.com/api(/:version)',
        '://(staging.)example.com/api(/:version)',
      )
      assertSource(
        '://(staging.)example.com/api(/:version)/resources/:id(.json)',
        '://(staging.)example.com/api(/:version)/resources/:id(.json)',
      )
      assertSource('http(s)://*host/path')
    })

    it('reconstructs full patterns', () => {
      assertSource('https://api.example.com:8000/v1/:resource')
      assertSource('http(s)://example.com/base')
      assertSource('http://old.com:3000/keep/this')
      assertSource('users/:id?tab=profile', '/users/:id?tab=profile')
      assertSource('://example.com/path?q=1&q=2&filter')
    })
  })

  describe('join', () => {
    function assertJoin(a: string, b: string, expected: string) {
      assert.deepEqual(
        new RoutePattern(a).join(new RoutePattern(b)),
        new RoutePattern(expected),
      )
    }

    it('joins protocol', () => {
      assertJoin('http://', '://', 'http://')
      assertJoin('://', '://', '://')
      assertJoin('://', 'http://', 'http://')

      assertJoin('http://', '://example.com', 'http://example.com')
      assertJoin('://example.com', 'http://', 'http://example.com')

      assertJoin('http://', 'https://', 'https://')
      assertJoin('://example.com', 'https://', 'https://example.com')
      assertJoin('http://example.com', 'https://', 'https://example.com')

      assertJoin('http(s)://', 'https://', 'https://')
      assertJoin('https://', 'http(s)://', 'http(s)://')
    })

    it('joins hostname', () => {
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

    it('joins port', () => {
      assertJoin('://:8000', '://', '://:8000')
      assertJoin('://', '://:8000', '://:8000')
      assertJoin('://:8000', '://:3000', '://:3000')
      assertJoin('://example.com', '://example.com:8000', '://example.com:8000')
      assertJoin('http://example.com:4321', '://example.com:8000', 'http://example.com:8000')
    })

    it('joins pathname', () => {
      assertJoin('', '', '')
      assertJoin('', 'b', 'b')
      assertJoin('a', '', 'a')

      assertJoin('a', 'b', 'a/b')
      assertJoin('a/', 'b', 'a/b')
      assertJoin('a', '/b', 'a/b')
      assertJoin('a/', '/b', 'a/b')

      assertJoin('(a)', '(b)', '(a)/(b)')
      assertJoin('(a/)', '(b)', '(a)/(b)')
      assertJoin('(a)', '(/b)', '(a)(/b)')
      assertJoin('(a/)', '(/b)', '(a)(/b)')
    })

    it('joins search', () => {
      assertJoin('path', '?a', 'path?a')
      assertJoin('?a', '?b=1', '?a&b=1')
      assertJoin('?a=1', '?b=2', '?a=1&b=2')
    })

    it('joins complex combinations', () => {
      assertJoin('http://example.com/a', 'http(s)://*host/b', 'http(s)://*host/a/b')
      assertJoin('http://example.com:8000/a', 'https:///b', 'https://example.com:8000/a/b')
      assertJoin('http://example.com:8000/a', '://other.com/b', 'http://other.com:8000/a/b')

      assertJoin(
        'https://api.example.com:8000/v1/:resource',
        '/users/(admin/)posts?filter&sort=asc',
        'https://api.example.com:8000/v1/:resource/users/(admin/)posts?filter&sort=asc',
      )

      assertJoin(
        'http(s)://example.com/base',
        'http(s)://other.com/path',
        'http(s)://other.com/base/path',
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

  describe('href', () => {
    function assertHref(
      pattern: string,
      params: Record<string, string | number> | undefined,
      expected: string,
    ) {
      assert.equal(new RoutePattern(pattern).href(params), expected)
    }

    function assertHrefWithSearch(
      pattern: string,
      params: Record<string, string | number> | undefined,
      searchParams: Search.HrefParams,
      expected: string,
    ) {
      assert.equal(new RoutePattern(pattern).href(params, searchParams), expected)
    }

    function assertHrefThrows(
      pattern: string,
      params: Record<string, string | number> | undefined,
      errorType: HrefError['details']['type'],
    ) {
      assert.throws(
        () => new RoutePattern(pattern).href(params),
        (error: unknown) => {
          return error instanceof HrefError && error.details.type === errorType
        },
      )
    }

    it('generates href for pathname only', () => {
      assertHref('/posts/:id', { id: '123' }, '/posts/123')
      assertHref('posts/:id', { id: '123' }, '/posts/123')
      assertHref('/posts(/:id)', { id: '123' }, '/posts/123')
      assertHref('/posts(/:id)', undefined, '/posts')
    })

    it('defaults protocol to https with origin', () => {
      assertHref('://example.com/path', undefined, 'https://example.com/path')
      assertHref('://:host/path', { host: 'example.com' }, 'https://example.com/path')
      assertHref(
        '://:host/posts/:id',
        { host: 'example.com', id: '123' },
        'https://example.com/posts/123',
      )
    })

    it('uses explicit protocol with origin', () => {
      assertHref('http://example.com/path', undefined, 'http://example.com/path')
      assertHref('https://example.com/posts/:id', { id: '123' }, 'https://example.com/posts/123')
      assertHref('http(s)://example.com/path', undefined, 'https://example.com/path')
    })

    it('includes port with origin', () => {
      assertHref('://example.com:8080/path', undefined, 'https://example.com:8080/path')
      assertHref('http://example.com:3000/path', undefined, 'http://example.com:3000/path')
      assertHref('://:host:8080/path', { host: 'localhost' }, 'https://localhost:8080/path')
    })

    it('throws when hostname required but missing for protocol', () => {
      assertHrefThrows('https://*/path', undefined, 'missing-hostname')
      assertHrefThrows('http://*host/path', undefined, 'missing-params')
    })

    it('throws when hostname required but missing for port', () => {
      assertHrefThrows('://:8080/path', undefined, 'missing-hostname')
      assertHrefThrows('://*:3000/path', undefined, 'missing-hostname')
    })

    it('generates href with search params', () => {
      assertHref('/posts?filter', undefined, '/posts?filter=')
      assertHrefWithSearch('/posts?filter', undefined, { filter: 'active' }, '/posts?filter=active')
      assertHref('/posts?sort=asc', undefined, '/posts?sort=asc')
      assertHrefWithSearch(
        '/posts?sort=asc',
        undefined,
        { sort: 'desc' },
        '/posts?sort=desc&sort=asc',
      )
      assertHrefThrows('/posts?filter=', undefined, 'missing-search-params')
      assertHrefWithSearch(
        '/posts?filter=',
        undefined,
        { filter: 'active' },
        '/posts?filter=active',
      )
      assertHrefWithSearch('/posts?sort=asc', undefined, { page: '2' }, '/posts?page=2&sort=asc')
      assertHref('/posts?tag=foo&tag=bar', undefined, '/posts?tag=foo&tag=bar')
      assertHrefWithSearch(
        '/posts?tag=foo&tag=bar',
        undefined,
        { tag: ['baz', 'qux'] },
        '/posts?tag=baz&tag=qux&tag=foo&tag=bar',
      )
      assertHrefWithSearch(
        '/posts',
        undefined,
        { category: ['books', 'electronics'] },
        '/posts?category=books&category=electronics',
      )
      // Deduplication: user provides same value as pattern
      assertHrefWithSearch('/posts?tag=foo', undefined, { tag: 'foo' }, '/posts?tag=foo')
      assertHrefWithSearch(
        '/posts?tag=foo&tag=bar',
        undefined,
        { tag: 'foo' },
        '/posts?tag=foo&tag=bar',
      )
    })
  })

  describe('match', () => {
    function assertMatch(
      pattern: string,
      url: string,
      expected: {
        params?: Record<string, string | undefined>
      } | null,
    ) {
      let match = new RoutePattern(pattern).match(url)

      if (expected === null) {
        assert.equal(match, null, `Expected pattern "${pattern}" to not match URL "${url}"`)
        return
      }

      assert.notEqual(match, null, `Expected pattern "${pattern}" to match URL "${url}"`)
      assert.deepEqual(match?.params, expected.params ?? {})
    }

    describe('protocol', () => {
      it('matches http', () => {
        assertMatch('http://example.com/path', 'http://example.com/path', {})
      })

      it('matches https', () => {
        assertMatch('https://example.com/path', 'https://example.com/path', {})
      })

      it('matches http(s) optional', () => {
        assertMatch('http(s)://example.com/path', 'http://example.com/path', {})
        assertMatch('http(s)://example.com/path', 'https://example.com/path', {})
      })
    })

    describe('hostname', () => {
      it('matches one variable', () => {
        assertMatch('://:host.com/path', 'https://example.com/path', {
          params: { host: 'example' },
        })
      })

      it('matches multiple variables', () => {
        assertMatch('://:subdomain.:domain.com/path', 'https://api.example.com/path', {
          params: { subdomain: 'api', domain: 'example' },
        })
      })

      it('matches multiple variables with repeated names', () => {
        assertMatch('://:part.:part.com/path', 'https://api.example.com/path', {
          params: { part: 'example' },
        })
      })

      it('excludes unnamed wildcard from params', () => {
        assertMatch('://*.example.com/path', 'https://api.example.com/path', {})
      })
    })

    describe('port', () => {
      it('matches when port is equal', () => {
        assertMatch('://example.com:8080/path', 'https://example.com:8080/path', {})
      })

      it('does not match when port differs', () => {
        assertMatch('://example.com:8080/path', 'https://example.com:3000/path', null)
      })
    })

    describe('pathname', () => {
      it('matches one variable', () => {
        assertMatch('/posts/:id', 'https://example.com/posts/123', { params: { id: '123' } })
      })

      it('matches multiple variables', () => {
        assertMatch('/users/:userId/posts/:postId', 'https://example.com/users/42/posts/123', {
          params: { userId: '42', postId: '123' },
        })
      })

      it('matches multiple variables with repeated names', () => {
        assertMatch('/:id/nested/:id', 'https://example.com/first/nested/second', {
          params: { id: 'second' },
        })
      })

      it('excludes unnamed wildcard from params', () => {
        assertMatch('/posts/*/comments', 'https://example.com/posts/123/comments', {})
      })
    })

    describe('search', () => {
      it('matches bare parameter for presence only', () => {
        assertMatch('?q', 'https://example.com?q', {})
      })

      it('matches bare parameter when URL has value', () => {
        assertMatch('?q', 'https://example.com?q=search', {})
      })

      it('requires non-empty value when pattern has empty value', () => {
        assertMatch('?q=', 'https://example.com?q=search', {})
        assertMatch('?q=', 'https://example.com?q=', null)
        assertMatch('?q=', 'https://example.com?q', null)
      })

      it('matches parameter with specific value', () => {
        assertMatch('?sort=asc', 'https://example.com?sort=asc', {})
      })

      it('matches parameter with multiple values', () => {
        assertMatch('?tag=foo&tag=bar', 'https://example.com?tag=foo&tag=bar', {})
      })

      it('matches multiple parameters', () => {
        assertMatch('?filter&sort=asc', 'https://example.com?filter=active&sort=asc', {})
      })

      it('allows extra parameters with bare constraint', () => {
        assertMatch('?q', 'https://example.com?q=search&page=2&limit=10', {})
      })

      it('allows extra parameters with empty value constraint', () => {
        assertMatch('?filter=', 'https://example.com?filter=active&sort=asc&page=1', {})
      })

      it('allows extra parameters with specific value', () => {
        assertMatch('?sort=asc', 'https://example.com?sort=asc&filter=active&page=2', {})
      })

      it('allows extra parameters with multiple constraints', () => {
        assertMatch(
          '?filter&sort=asc',
          'https://example.com?filter=active&sort=asc&page=1&limit=20',
          {},
        )
      })

      it('allows extra values for constrained parameter', () => {
        assertMatch('?tag=foo', 'https://example.com?tag=foo&tag=bar&tag=baz', {})
      })

      it('does not match when required parameter is missing', () => {
        assertMatch('?filter', 'https://example.com?sort=asc', null)
      })

      it('does not match when required value is missing', () => {
        assertMatch('?sort=asc', 'https://example.com?sort=desc', null)
      })

      it('matches any search params when no constraints specified', () => {
        assertMatch('/posts', 'https://example.com/posts?q=search&page=2', {})
        assertMatch('/posts', 'https://example.com/posts', {})
      })
    })
  })

  describe('ignoreCase', () => {
    it('defaults to false for case-sensitive matching', () => {
      let pattern = new RoutePattern('/posts/:id')
      assert.equal(pattern.ignoreCase, false)
    })

    it('can be set to true in parse options', () => {
      let pattern = new RoutePattern('/posts/:id', { ignoreCase: true })
      assert.equal(pattern.ignoreCase, true)
    })

    describe('pathname matching', () => {
      it('is case-sensitive by default', () => {
        let pattern = new RoutePattern('/Posts/:id')
        assert.equal(pattern.match('https://example.com/posts/123'), null)
        assert.equal(pattern.match('https://example.com/POSTS/123'), null)
        assert.notEqual(pattern.match('https://example.com/Posts/123'), null)
      })

      it('is case-insensitive when enabled', () => {
        let pattern = new RoutePattern('/Posts/:id', { ignoreCase: true })
        assert.notEqual(pattern.match('https://example.com/posts/123'), null)
        assert.notEqual(pattern.match('https://example.com/POSTS/123'), null)
        assert.notEqual(pattern.match('https://example.com/PoStS/123'), null)
      })

      it('preserves original casing in params for case-insensitive matches', () => {
        let pattern = new RoutePattern('/posts/:id', { ignoreCase: true })
        let match = pattern.match('https://example.com/POSTS/ABC')
        assert.notEqual(match, null)
        assert.equal(match!.params.id, 'ABC')
      })
    })

    describe('search matching', () => {
      it('is case-sensitive for param names by default', () => {
        let pattern = new RoutePattern('?Sort')
        assert.notEqual(pattern.match('https://example.com?Sort'), null)
        assert.equal(pattern.match('https://example.com?sort'), null)
        assert.equal(pattern.match('https://example.com?SORT'), null)
      })

      it('is case-insensitive for param names when enabled', () => {
        let pattern = new RoutePattern('?Sort', { ignoreCase: true })
        assert.notEqual(pattern.match('https://example.com?Sort'), null)
        assert.notEqual(pattern.match('https://example.com?sort'), null)
        assert.notEqual(pattern.match('https://example.com?SORT'), null)
      })

      it('is case-sensitive for param values by default', () => {
        let pattern = new RoutePattern('?sort=Asc')
        assert.notEqual(pattern.match('https://example.com?sort=Asc'), null)
        assert.equal(pattern.match('https://example.com?sort=asc'), null)
        assert.equal(pattern.match('https://example.com?sort=ASC'), null)
      })

      it('is case-insensitive for param values when enabled', () => {
        let pattern = new RoutePattern('?sort=Asc', { ignoreCase: true })
        assert.notEqual(pattern.match('https://example.com?sort=Asc'), null)
        assert.notEqual(pattern.match('https://example.com?sort=asc'), null)
        assert.notEqual(pattern.match('https://example.com?sort=ASC'), null)
      })

      it('applies case-insensitivity to multiple search params', () => {
        let pattern = new RoutePattern('?Sort=Asc&Filter=Active', { ignoreCase: true })
        assert.notEqual(pattern.match('https://example.com?sort=asc&filter=active'), null)
        assert.notEqual(pattern.match('https://example.com?SORT=ASC&FILTER=ACTIVE'), null)
      })
    })

    describe('join', () => {
      it('uses union for ignoreCase (true if either is true)', () => {
        let a = new RoutePattern('/api', { ignoreCase: true })
        let b = new RoutePattern('/posts', { ignoreCase: false })
        assert.equal(a.join(b).ignoreCase, true)

        let c = new RoutePattern('/api', { ignoreCase: false })
        let d = new RoutePattern('/posts', { ignoreCase: true })
        assert.equal(c.join(d).ignoreCase, true)

        let e = new RoutePattern('/api', { ignoreCase: false })
        let f = new RoutePattern('/posts', { ignoreCase: false })
        assert.equal(e.join(f).ignoreCase, false)

        let g = new RoutePattern('/api', { ignoreCase: true })
        let h = new RoutePattern('/posts', { ignoreCase: true })
        assert.equal(g.join(h).ignoreCase, true)
      })

      it('allows overriding ignoreCase with options', () => {
        let a = new RoutePattern('/api', { ignoreCase: false })
        let b = new RoutePattern('/posts', { ignoreCase: false })
        let joined = a.join(b, { ignoreCase: true })
        assert.equal(joined.ignoreCase, true)
      })

      it('matches joined pattern according to its ignoreCase setting', () => {
        let a = new RoutePattern('/api', { ignoreCase: false })
        let b = new RoutePattern('/posts', { ignoreCase: false })
        let joined = a.join(b, { ignoreCase: true })
        assert.notEqual(joined.match('https://example.com/API/POSTS'), null)
      })
    })
  })
})
