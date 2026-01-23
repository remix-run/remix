import * as assert from 'node:assert/strict'
import test, { describe } from 'node:test'
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

    test('throws on invalid protocol', () => {
      assert.throws(() => RoutePattern.parse('ftp://example.com'), {
        name: 'ParseError',
        type: 'invalid protocol',
      })
      assert.throws(() => RoutePattern.parse('ws://example.com/path'), {
        name: 'ParseError',
        type: 'invalid protocol',
      })
      assert.throws(() => RoutePattern.parse('httpx://example.com'), {
        name: 'ParseError',
        type: 'invalid protocol',
      })
      assert.throws(() => RoutePattern.parse('http(s)x://example.com'), {
        name: 'ParseError',
        type: 'invalid protocol',
      })
    })
  })

  describe('part accessors', () => {
    test('protocol', () => {
      assert.equal(RoutePattern.parse('http://example.com').protocol, 'http')
      assert.equal(RoutePattern.parse('https://example.com').protocol, 'https')
      assert.equal(RoutePattern.parse('http(s)://example.com').protocol, 'http(s)')
      assert.equal(RoutePattern.parse('/pathname').protocol, '')
      assert.equal(RoutePattern.parse('://example.com').protocol, '')
    })

    test('hostname', () => {
      assert.equal(RoutePattern.parse('://example.com').hostname, 'example.com')
      assert.equal(RoutePattern.parse('://:host').hostname, ':host')
      assert.equal(RoutePattern.parse('://api.example.com').hostname, 'api.example.com')
      assert.equal(RoutePattern.parse('/pathname').hostname, '')
      assert.equal(RoutePattern.parse('http://').hostname, '')
    })

    test('port', () => {
      assert.equal(RoutePattern.parse('://example.com:8000').port, '8000')
      assert.equal(RoutePattern.parse('://example.com:3000').port, '3000')
      assert.equal(RoutePattern.parse('://example.com').port, '')
      assert.equal(RoutePattern.parse('/pathname').port, '')
    })

    test('pathname', () => {
      assert.equal(RoutePattern.parse('/posts/:id').pathname, 'posts/:id')
      assert.equal(RoutePattern.parse('posts/:id').pathname, 'posts/:id')
      assert.equal(RoutePattern.parse('/posts(/:id)').pathname, 'posts(/:id)')
      assert.equal(RoutePattern.parse('://example.com').pathname, '')
      assert.equal(RoutePattern.parse('/').pathname, '')
      assert.equal(RoutePattern.parse('').pathname, '')
    })

    test('search', () => {
      assert.equal(RoutePattern.parse('?q').search, 'q')
      assert.equal(RoutePattern.parse('?q=').search, 'q=')
      assert.equal(RoutePattern.parse('?q=1').search, 'q=1')
      assert.equal(RoutePattern.parse('?q=1&q=2').search, 'q=1&q=2')
      assert.equal(RoutePattern.parse('/posts?filter').search, 'filter')
      assert.equal(RoutePattern.parse('/posts?sort=asc').search, 'sort=asc')
      assert.equal(RoutePattern.parse('/posts').search, '')
      assert.equal(RoutePattern.parse('').search, '')
    })

    test('all parts together', () => {
      let pattern = RoutePattern.parse('https://api.example.com:8000/v1/:resource?filter=active')
      assert.equal(pattern.protocol, 'https')
      assert.equal(pattern.hostname, 'api.example.com')
      assert.equal(pattern.port, '8000')
      assert.equal(pattern.pathname, 'v1/:resource')
      assert.equal(pattern.search, 'filter=active')
    })
  })

  describe('source', () => {
    function assertSource(source: string, expected?: string) {
      assert.equal(RoutePattern.parse(source).source, expected ?? source)
    }

    test('pathname only', () => {
      assertSource('/posts/:id')
      assertSource('posts/:id', '/posts/:id')
      assertSource('/posts(/:id)')
      assertSource('/', '/')
      assertSource('', '/')
    })

    test('hostname only', () => {
      assertSource('://example.com', '://example.com/')
      assertSource('://:host', '://:host/')
    })

    test('port', () => {
      assertSource('://example.com:8000', '://example.com:8000/')
      assertSource('://example.com:3000', '://example.com:3000/')
      assertSource('://:host:8080', '://:host:8080/')
    })

    test('protocol', () => {
      assertSource('http://', 'http:///')
      assertSource('https://', 'https:///')
      assertSource('http(s)://', 'http(s):///')
    })

    test('protocol + hostname', () => {
      assertSource('https://example.com', 'https://example.com/')
      assertSource('http://example.com', 'http://example.com/')
      assertSource('http(s)://*host', 'http(s)://*host/')
    })

    test('protocol + hostname + pathname', () => {
      assertSource('https://example.com/about')
      assertSource('http://example.com/products/:id')
      assertSource('http(s)://*host/path')
    })

    test('protocol + hostname + port + pathname', () => {
      assertSource('https://example.com:8000/about')
      assertSource('http://localhost:3000/posts/:id')
      assertSource('http(s)://example.com:8000/path')
    })

    test('search params', () => {
      assertSource('?q', '/?q')
      assertSource('?q=', '/?q=')
      assertSource('?q=1', '/?q=1')
      assertSource('?q=1&q=2', '/?q=1&q=2')
      assertSource('/posts?filter')
      assertSource('/posts?sort=asc')
      assertSource('/posts?tag=foo&tag=bar')
      assertSource('https://example.com/posts?q=1')
    })

    test('complex patterns with optionals', () => {
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

    test('full patterns', () => {
      assertSource('https://api.example.com:8000/v1/:resource')
      assertSource('http(s)://example.com/base')
      assertSource('http://old.com:3000/keep/this')
      assertSource('users/:id?tab=profile', '/users/:id?tab=profile')
      assertSource('://example.com/path?q=1&q=2&filter')
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

      assertJoin('(a)', '(b)', '(a)/(b)')
      assertJoin('(a/)', '(b)', '(a)/(b)')
      assertJoin('(a)', '(/b)', '(a)(/b)')
      assertJoin('(a/)', '(/b)', '(a)(/b)')
    })

    test('search', () => {
      assertJoin('path', '?a', 'path?a')
      assertJoin('?a', '?b=1', '?a&b=1')
      assertJoin('?a=1', '?b=2', '?a=1&b=2')
    })

    test('combos', () => {
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
      assert.equal(RoutePattern.parse(pattern).href(params), expected)
    }

    function assertHrefWithSearch(
      pattern: string,
      params: Record<string, string | number> | undefined,
      searchParams: Search.HrefParams,
      expected: string,
    ) {
      assert.equal(RoutePattern.parse(pattern).href(params, searchParams), expected)
    }

    function assertHrefThrows(
      pattern: string,
      params: Record<string, string | number> | undefined,
      errorType: HrefError['details']['type'],
    ) {
      assert.throws(
        () => RoutePattern.parse(pattern).href(params),
        (error: unknown) => {
          return error instanceof HrefError && error.details.type === errorType
        },
      )
    }

    test('pathname only', () => {
      assertHref('/posts/:id', { id: '123' }, '/posts/123')
      assertHref('posts/:id', { id: '123' }, '/posts/123')
      assertHref('/posts(/:id)', { id: '123' }, '/posts/123')
      assertHref('/posts(/:id)', undefined, '/posts')
    })

    test('with origin - protocol defaults to https', () => {
      assertHref('://example.com/path', undefined, 'https://example.com/path')
      assertHref('://:host/path', { host: 'example.com' }, 'https://example.com/path')
      assertHref(
        '://:host/posts/:id',
        { host: 'example.com', id: '123' },
        'https://example.com/posts/123',
      )
    })

    test('with origin - explicit protocol', () => {
      assertHref('http://example.com/path', undefined, 'http://example.com/path')
      assertHref('https://example.com/posts/:id', { id: '123' }, 'https://example.com/posts/123')
      assertHref('http(s)://example.com/path', undefined, 'https://example.com/path')
    })

    test('with origin - port', () => {
      assertHref('://example.com:8080/path', undefined, 'https://example.com:8080/path')
      assertHref('http://example.com:3000/path', undefined, 'http://example.com:3000/path')
      assertHref('://:host:8080/path', { host: 'localhost' }, 'https://localhost:8080/path')
    })

    test('origin validation - hostname required when protocol specified', () => {
      assertHrefThrows('https://*/path', undefined, 'missing-hostname')
      assertHrefThrows('http://*host/path', undefined, 'missing-params')
    })

    test('origin validation - hostname required when port specified', () => {
      assertHrefThrows('://:8080/path', undefined, 'missing-hostname')
      assertHrefThrows('://*:3000/path', undefined, 'missing-hostname')
    })

    test('search params', () => {
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
      let match = RoutePattern.parse(pattern).match(url)

      if (expected === null) {
        assert.equal(match, null, `Expected pattern "${pattern}" to not match URL "${url}"`)
        return
      }

      assert.notEqual(match, null, `Expected pattern "${pattern}" to match URL "${url}"`)
      assert.deepStrictEqual(match?.params, expected.params ?? {})
    }

    describe('protocol', () => {
      test('http', () => {
        assertMatch('http://example.com/path', 'http://example.com/path', {})
      })

      test('https', () => {
        assertMatch('https://example.com/path', 'https://example.com/path', {})
      })

      test('http(s)', () => {
        assertMatch('http(s)://example.com/path', 'http://example.com/path', {})
        assertMatch('http(s)://example.com/path', 'https://example.com/path', {})
      })
    })

    describe('hostname', () => {
      test('one variable', () => {
        assertMatch('://:host.com/path', 'https://example.com/path', {
          params: { host: 'example' },
        })
      })

      test('multiple variables', () => {
        assertMatch('://:subdomain.:domain.com/path', 'https://api.example.com/path', {
          params: { subdomain: 'api', domain: 'example' },
        })
      })

      test('multiple variables with repeated names', () => {
        assertMatch('://:part.:part.com/path', 'https://api.example.com/path', {
          params: { part: 'example' },
        })
      })

      test('unnamed wildcard does not appear in params', () => {
        assertMatch('://*.example.com/path', 'https://api.example.com/path', {})
      })
    })

    describe('port', () => {
      test('matches', () => {
        assertMatch('://example.com:8080/path', 'https://example.com:8080/path', {})
      })

      test('does not match', () => {
        assertMatch('://example.com:8080/path', 'https://example.com:3000/path', null)
      })
    })

    describe('pathname', () => {
      test('one variable', () => {
        assertMatch('/posts/:id', 'https://example.com/posts/123', { params: { id: '123' } })
      })

      test('multiple variables', () => {
        assertMatch('/users/:userId/posts/:postId', 'https://example.com/users/42/posts/123', {
          params: { userId: '42', postId: '123' },
        })
      })

      test('multiple variables with repeated names', () => {
        assertMatch('/:id/nested/:id', 'https://example.com/first/nested/second', {
          params: { id: 'second' },
        })
      })

      test('unnamed wildcard does not appear in params', () => {
        assertMatch('/posts/*/comments', 'https://example.com/posts/123/comments', {})
      })
    })

    describe('search', () => {
      test('bare parameter (presence only)', () => {
        assertMatch('?q', 'https://example.com?q', {})
      })

      test('bare parameter matches when URL has value', () => {
        assertMatch('?q', 'https://example.com?q=search', {})
      })

      test('parameter with empty value requires non-empty value in URL', () => {
        assertMatch('?q=', 'https://example.com?q=search', {})
        assertMatch('?q=', 'https://example.com?q=', null)
        assertMatch('?q=', 'https://example.com?q', null)
      })

      test('parameter with specific value', () => {
        assertMatch('?sort=asc', 'https://example.com?sort=asc', {})
      })

      test('parameter with multiple values', () => {
        assertMatch('?tag=foo&tag=bar', 'https://example.com?tag=foo&tag=bar', {})
      })

      test('multiple parameters', () => {
        assertMatch('?filter&sort=asc', 'https://example.com?filter=active&sort=asc', {})
      })

      test('allows extra parameters with bare constraint', () => {
        assertMatch('?q', 'https://example.com?q=search&page=2&limit=10', {})
      })

      test('allows extra parameters with empty value constraint', () => {
        assertMatch('?filter=', 'https://example.com?filter=active&sort=asc&page=1', {})
      })

      test('allows extra parameters with specific value', () => {
        assertMatch('?sort=asc', 'https://example.com?sort=asc&filter=active&page=2', {})
      })

      test('allows extra parameters with multiple constraints', () => {
        assertMatch(
          '?filter&sort=asc',
          'https://example.com?filter=active&sort=asc&page=1&limit=20',
          {},
        )
      })

      test('allows extra values for constrained parameter', () => {
        assertMatch('?tag=foo', 'https://example.com?tag=foo&tag=bar&tag=baz', {})
      })

      test('does not match when required parameter missing', () => {
        assertMatch('?filter', 'https://example.com?sort=asc', null)
      })

      test('does not match when required value missing', () => {
        assertMatch('?sort=asc', 'https://example.com?sort=desc', null)
      })

      test('no search constraints matches any search params', () => {
        assertMatch('/posts', 'https://example.com/posts?q=search&page=2', {})
        assertMatch('/posts', 'https://example.com/posts', {})
      })
    })
  })

  describe('ignoreCase', () => {
    test('defaults to false (case-sensitive)', () => {
      let pattern = RoutePattern.parse('/posts/:id')
      assert.equal(pattern.ignoreCase, false)
    })

    test('can be set to true in parse options', () => {
      let pattern = RoutePattern.parse('/posts/:id', { ignoreCase: true })
      assert.equal(pattern.ignoreCase, true)
    })

    describe('pathname matching', () => {
      test('case-sensitive by default', () => {
        let pattern = RoutePattern.parse('/Posts/:id')
        assert.equal(pattern.match('https://example.com/posts/123'), null)
        assert.equal(pattern.match('https://example.com/POSTS/123'), null)
        assert.notEqual(pattern.match('https://example.com/Posts/123'), null)
      })

      test('case-insensitive when enabled', () => {
        let pattern = RoutePattern.parse('/Posts/:id', { ignoreCase: true })
        assert.notEqual(pattern.match('https://example.com/posts/123'), null)
        assert.notEqual(pattern.match('https://example.com/POSTS/123'), null)
        assert.notEqual(pattern.match('https://example.com/PoStS/123'), null)
      })

      test('case-insensitive matches return original casing in params', () => {
        let pattern = RoutePattern.parse('/posts/:id', { ignoreCase: true })
        let match = pattern.match('https://example.com/POSTS/ABC')
        assert.notEqual(match, null)
        assert.equal(match!.params.id, 'ABC')
      })
    })

    describe('search matching', () => {
      test('case-sensitive by default - param names', () => {
        let pattern = RoutePattern.parse('?Sort')
        assert.notEqual(pattern.match('https://example.com?Sort'), null)
        assert.equal(pattern.match('https://example.com?sort'), null)
        assert.equal(pattern.match('https://example.com?SORT'), null)
      })

      test('case-insensitive param names when enabled', () => {
        let pattern = RoutePattern.parse('?Sort', { ignoreCase: true })
        assert.notEqual(pattern.match('https://example.com?Sort'), null)
        assert.notEqual(pattern.match('https://example.com?sort'), null)
        assert.notEqual(pattern.match('https://example.com?SORT'), null)
      })

      test('case-sensitive by default - param values', () => {
        let pattern = RoutePattern.parse('?sort=Asc')
        assert.notEqual(pattern.match('https://example.com?sort=Asc'), null)
        assert.equal(pattern.match('https://example.com?sort=asc'), null)
        assert.equal(pattern.match('https://example.com?sort=ASC'), null)
      })

      test('case-insensitive param values when enabled', () => {
        let pattern = RoutePattern.parse('?sort=Asc', { ignoreCase: true })
        assert.notEqual(pattern.match('https://example.com?sort=Asc'), null)
        assert.notEqual(pattern.match('https://example.com?sort=asc'), null)
        assert.notEqual(pattern.match('https://example.com?sort=ASC'), null)
      })

      test('case-insensitive works with multiple search params', () => {
        let pattern = RoutePattern.parse('?Sort=Asc&Filter=Active', { ignoreCase: true })
        assert.notEqual(pattern.match('https://example.com?sort=asc&filter=active'), null)
        assert.notEqual(pattern.match('https://example.com?SORT=ASC&FILTER=ACTIVE'), null)
      })
    })

    describe('join', () => {
      test('uses union (true if either is true) by default', () => {
        let a = RoutePattern.parse('/api', { ignoreCase: true })
        let b = RoutePattern.parse('/posts', { ignoreCase: false })
        assert.equal(a.join(b).ignoreCase, true)

        let c = RoutePattern.parse('/api', { ignoreCase: false })
        let d = RoutePattern.parse('/posts', { ignoreCase: true })
        assert.equal(c.join(d).ignoreCase, true)

        let e = RoutePattern.parse('/api', { ignoreCase: false })
        let f = RoutePattern.parse('/posts', { ignoreCase: false })
        assert.equal(e.join(f).ignoreCase, false)

        let g = RoutePattern.parse('/api', { ignoreCase: true })
        let h = RoutePattern.parse('/posts', { ignoreCase: true })
        assert.equal(g.join(h).ignoreCase, true)
      })

      test('can override ignoreCase with options', () => {
        let a = RoutePattern.parse('/api', { ignoreCase: false })
        let b = RoutePattern.parse('/posts', { ignoreCase: false })
        let joined = a.join(b, { ignoreCase: true })
        assert.equal(joined.ignoreCase, true)
      })

      test('joined pattern matches according to its ignoreCase setting', () => {
        let a = RoutePattern.parse('/api', { ignoreCase: false })
        let b = RoutePattern.parse('/posts', { ignoreCase: false })
        let joined = a.join(b, { ignoreCase: true })
        assert.notEqual(joined.match('https://example.com/API/POSTS'), null)
      })
    })
  })
})
