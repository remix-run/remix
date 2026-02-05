import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { RoutePattern } from './route-pattern.ts'
import { HrefError } from './route-pattern/href.ts'

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
          hostname: pattern.ast.hostname?.source ?? null,
          port: pattern.ast.port,
          pathname: pattern.ast.pathname.source,
          search: pattern.ast.search,
        },
        {
          // explicitly set each prop so that we can omitted keys from `expected` to set them as defaults
          protocol: expected.protocol ?? null,
          hostname: expected.hostname ?? null,
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
      assert.deepEqual(new RoutePattern(a).join(new RoutePattern(b)), new RoutePattern(expected))
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
    function hrefError(type: HrefError['details']['type']) {
      return (error: unknown) => error instanceof HrefError && error.details.type === type
    }

    describe('protocol', () => {
      it('defaults omitted protocol (://) to https', () => {
        let pattern = new RoutePattern('://example.com/path')
        let result = pattern.href()
        assert.equal(result, 'https://example.com/path')
      })

      it('defaults http(s) to https', () => {
        let pattern = new RoutePattern('http(s)://example.com/path')
        let result = pattern.href()
        assert.equal(result, 'https://example.com/path')
      })

      it('supports explicit http', () => {
        let pattern = new RoutePattern('http://example.com/path')
        let result = pattern.href()
        assert.equal(result, 'http://example.com/path')
      })

      it('supports explicit https', () => {
        let pattern = new RoutePattern('https://example.com/path')
        let result = pattern.href()
        assert.equal(result, 'https://example.com/path')
      })
    })

    describe('hostname', () => {
      describe('when origin is present', () => {
        it('throws when protocol specified', () => {
          let pattern = new RoutePattern('https://*/path')
          // @ts-expect-error - missing hostname
          assert.throws(() => pattern.href(), hrefError('missing-hostname'))
        })

        it('throws when protocol with named wildcard missing param', () => {
          let pattern = new RoutePattern('http://*host/path')
          // @ts-expect-error - missing required param
          assert.throws(() => pattern.href(), hrefError('missing-params'))
        })

        it('throws when port specified', () => {
          let pattern = new RoutePattern('://:8080/path')
          assert.throws(() => pattern.href(), hrefError('missing-hostname'))
        })
      })

      it('supports static hostname', () => {
        let pattern = new RoutePattern('://example.com/path')
        let result = pattern.href()
        assert.equal(result, 'https://example.com/path')
      })

      describe('with dynamic segment', () => {
        it('works when provided', () => {
          let pattern = new RoutePattern('://:host.com/path')
          let result = pattern.href({ host: 'example' })
          assert.equal(result, 'https://example.com/path')
        })

        it('throws when missing', () => {
          let pattern = new RoutePattern('://:host/path')
          // @ts-expect-error - missing required param
          assert.throws(() => pattern.href(), hrefError('missing-params'))
        })
      })

      it('supports multiple dynamic segments', () => {
        let pattern = new RoutePattern('://:subdomain.:domain.com/path')
        let result = pattern.href({ subdomain: 'api', domain: 'example' })
        assert.equal(result, 'https://api.example.com/path')
      })

      it('supports named wildcard', () => {
        let pattern = new RoutePattern('://*env.example.com/path')
        let result = pattern.href({ env: 'staging' })
        assert.equal(result, 'https://staging.example.com/path')
      })

      it('throws for nameless wildcard', () => {
        let pattern = new RoutePattern('://*.example.com/path')
        // @ts-expect-error - missing required param
        assert.throws(() => pattern.href(), hrefError('nameless-wildcard'))
      })

      it('includes optional with static content', () => {
        let pattern = new RoutePattern('://(www.)example.com/path')
        let result = pattern.href()
        assert.equal(result, 'https://www.example.com/path')
      })
    })

    describe('port', () => {
      it('supports static port', () => {
        let pattern = new RoutePattern('://example.com:8080/path')
        let result = pattern.href()
        assert.equal(result, 'https://example.com:8080/path')
      })

      it('works with hostname params', () => {
        let pattern = new RoutePattern('://:host:8080/path')
        let result = pattern.href({ host: 'localhost' })
        assert.equal(result, 'https://localhost:8080/path')
      })
    })

    describe('pathname', () => {
      it('supports static pathname', () => {
        let pattern = new RoutePattern('/posts')
        let result = pattern.href()
        assert.equal(result, '/posts')
      })

      it('normalizes static pathname without leading slash', () => {
        let pattern = new RoutePattern('posts')
        let result = pattern.href()
        assert.equal(result, '/posts')
      })

      describe('with dynamic segment', () => {
        it('works when provided', () => {
          let pattern = new RoutePattern('/posts/:id')
          let result = pattern.href({ id: '123' })
          assert.equal(result, '/posts/123')
        })

        it('works with number params', () => {
          let pattern = new RoutePattern('/posts/:id')
          let result = pattern.href({ id: 123 })
          assert.equal(result, '/posts/123')
        })

        it('ignores unrelated params', () => {
          let pattern = new RoutePattern('/posts/:id')
          let result = pattern.href({ id: '123', page: '2', sort: 'desc' })
          assert.equal(result, '/posts/123')
        })

        it('throws when missing', () => {
          let pattern = new RoutePattern('/posts/:id')
          // @ts-expect-error - missing required param
          assert.throws(() => pattern.href(), hrefError('missing-params'))
        })
      })

      it('supports multiple dynamic segments', () => {
        let pattern = new RoutePattern('/users/:userId/posts/:postId')
        let result = pattern.href({ userId: '42', postId: '123' })
        assert.equal(result, '/users/42/posts/123')
      })

      it('supports named wildcard', () => {
        let pattern = new RoutePattern('/files/*path')
        let result = pattern.href({ path: 'docs/readme.md' })
        assert.equal(result, '/files/docs/readme.md')
      })

      it('supports wildcard with number param', () => {
        let pattern = new RoutePattern('/files/*path')
        let result = pattern.href({ path: 123 })
        assert.equal(result, '/files/123')
      })

      it('throws for unnamed wildcard', () => {
        let pattern = new RoutePattern('/files/*')
        // @ts-expect-error - missing required param
        assert.throws(() => pattern.href(), hrefError('nameless-wildcard'))
      })

      it('supports repeated params', () => {
        let pattern = new RoutePattern('/:lang/users/:userId/:lang/posts/:postId')
        let result = pattern.href({ lang: 'en', userId: '42', postId: '123' })
        assert.equal(result, '/en/users/42/en/posts/123')
      })
    })

    describe('pattern with optionals', () => {
      it('includes optional with static content', () => {
        let pattern = new RoutePattern('/posts(/edit)')
        let result = pattern.href()
        assert.equal(result, '/posts/edit')
      })

      it('includes optional with variable when provided', () => {
        let pattern = new RoutePattern('/posts(/:id)')
        let result = pattern.href({ id: '123' })
        assert.equal(result, '/posts/123')
      })

      it('omits optional with variable when omitted', () => {
        let pattern = new RoutePattern('/posts(/:id)')
        let result = pattern.href()
        assert.equal(result, '/posts')
      })

      it('includes optional with wildcard when provided', () => {
        let pattern = new RoutePattern('/files(/*path)')
        let result = pattern.href({ path: 'docs/readme.md' })
        assert.equal(result, '/files/docs/readme.md')
      })

      it('omits optional with wildcard when omitted', () => {
        let pattern = new RoutePattern('/files(/*path)')
        let result = pattern.href()
        assert.equal(result, '/files')
      })

      it('omits optional with nameless wildcard', () => {
        let pattern = new RoutePattern('/files(/*)')
        let result = pattern.href()
        assert.equal(result, '/files')
      })

      describe('with nested optionals', () => {
        it('includes all when all provided', () => {
          let pattern = new RoutePattern('/blog/:year(/:month(/:day))')
          let result = pattern.href({ year: '2024', month: '01', day: '15' })
          assert.equal(result, '/blog/2024/01/15')
        })

        it('includes only outer when inner omitted', () => {
          let pattern = new RoutePattern('/blog/:year(/:month(/:day))')
          let result = pattern.href({ year: '2024', month: '01' })
          assert.equal(result, '/blog/2024/01')
        })

        it('omits both when only inner provided', () => {
          let pattern = new RoutePattern('/blog/:year(/:month(/:day))')
          let result = pattern.href({ year: '2024', day: '15' })
          assert.equal(result, '/blog/2024')
        })

        it('omits both when neither provided', () => {
          let pattern = new RoutePattern('/blog/:year(/:month(/:day))')
          let result = pattern.href({ year: '2024' })
          assert.equal(result, '/blog/2024')
        })
      })

      describe('with multiple optionals', () => {
        it('includes both when both provided', () => {
          let pattern = new RoutePattern('/posts(/:id)(/:action)')
          let result = pattern.href({ id: '123', action: 'edit' })
          assert.equal(result, '/posts/123/edit')
        })

        it('includes only first when second omitted', () => {
          let pattern = new RoutePattern('/posts(/:id)(/:action)')
          let result = pattern.href({ id: '123' })
          assert.equal(result, '/posts/123')
        })

        it('includes only second when first omitted', () => {
          let pattern = new RoutePattern('/posts(/:id)(/:action)')
          let result = pattern.href({ action: 'edit' })
          assert.equal(result, '/posts/edit')
        })

        it('omits both when neither provided', () => {
          let pattern = new RoutePattern('/posts(/:id)(/:action)')
          let result = pattern.href()
          assert.equal(result, '/posts')
        })
      })

      it('handles optional locale and page on home route', () => {
        let pattern = new RoutePattern('(/:locale)(/:page)')
        let result = pattern.href()
        assert.equal(result, '/')
      })
    })

    describe('search params', () => {
      it('works with no constraints', () => {
        let pattern = new RoutePattern('/posts')
        let result = pattern.href(undefined, { category: ['books', 'electronics'] })
        assert.equal(result, '/posts?category=books&category=electronics')
      })

      describe('with bare constraint (?q)', () => {
        it('includes empty value without user param', () => {
          let pattern = new RoutePattern('/posts?filter')
          let result = pattern.href()
          assert.equal(result, '/posts?filter=')
        })

        it('uses user param value', () => {
          let pattern = new RoutePattern('/posts?filter')
          let result = pattern.href(undefined, { filter: 'active' })
          assert.equal(result, '/posts?filter=active')
        })
      })

      describe('with empty-value constraint (?q=)', () => {
        it('throws without user param', () => {
          let pattern = new RoutePattern('/posts?filter=')
          assert.throws(() => pattern.href(), hrefError('missing-search-params'))
        })

        it('uses user param value', () => {
          let pattern = new RoutePattern('/posts?filter=')
          let result = pattern.href(undefined, { filter: 'active' })
          assert.equal(result, '/posts?filter=active')
        })
      })

      describe('with specific-value constraint (?q=foo)', () => {
        it('uses pattern value only', () => {
          let pattern = new RoutePattern('/posts?sort=asc')
          let result = pattern.href()
          assert.equal(result, '/posts?sort=asc')
        })

        it('prepends user params', () => {
          let pattern = new RoutePattern('/posts?sort=asc')
          let result = pattern.href(undefined, { sort: 'desc' })
          assert.equal(result, '/posts?sort=desc&sort=asc')
        })

        it('deduplicates when user matches pattern', () => {
          let pattern = new RoutePattern('/posts?tag=featured')
          let result = pattern.href(undefined, { tag: 'featured' })
          assert.equal(result, '/posts?tag=featured')
        })

        it('deduplicates when user matches one of multiple pattern values', () => {
          let pattern = new RoutePattern('/posts?tag=featured&tag=popular')
          let result = pattern.href(undefined, { tag: 'featured' })
          assert.equal(result, '/posts?tag=featured&tag=popular')
        })

        it('handles array values', () => {
          let pattern = new RoutePattern('/posts?tag=featured&tag=popular')
          let result = pattern.href(undefined, { tag: ['tutorial', 'beginner'] })
          assert.equal(result, '/posts?tag=tutorial&tag=beginner&tag=featured&tag=popular')
        })
      })

      it('supports additional user params', () => {
        let pattern = new RoutePattern('/posts?sort=asc')
        let result = pattern.href(undefined, { page: '2' })
        assert.equal(result, '/posts?page=2&sort=asc')
      })
    })

    describe('format', () => {
      it('returns relative URL for pathname only', () => {
        let pattern = new RoutePattern('/posts/:id')
        let result = pattern.href({ id: '123' })
        assert.equal(result, '/posts/123')
      })

      it('returns absolute URL with protocol', () => {
        let pattern = new RoutePattern('https://example.com/path')
        let result = pattern.href()
        assert.equal(result, 'https://example.com/path')
      })

      it('returns absolute URL with hostname', () => {
        let pattern = new RoutePattern('://example.com/path')
        let result = pattern.href()
        assert.equal(result, 'https://example.com/path')
      })

      it('returns absolute URL with port', () => {
        let pattern = new RoutePattern('://example.com:8080/path')
        let result = pattern.href()
        assert.equal(result, 'https://example.com:8080/path')
      })
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

      it('excludes nameless wildcard from params', () => {
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

      it('excludes nameless wildcard from params', () => {
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
    it('pathname is case-sensitive by default', () => {
      let pattern = new RoutePattern('/Posts/:id')
      assert.equal(pattern.match('https://example.com/posts/123'), null)
      assert.equal(pattern.match('https://example.com/POSTS/123'), null)
      assert.notEqual(pattern.match('https://example.com/Posts/123'), null)
    })

    it('pathname is case-insensitive when match(url, { ignoreCase: true })', () => {
      let pattern = new RoutePattern('/Posts/:id')
      assert.notEqual(pattern.match('https://example.com/posts/123', { ignoreCase: true }), null)
      assert.notEqual(pattern.match('https://example.com/POSTS/123', { ignoreCase: true }), null)
      assert.notEqual(pattern.match('https://example.com/PoStS/123', { ignoreCase: true }), null)
    })

    it('preserves original casing in params for case-insensitive pathname match', () => {
      let pattern = new RoutePattern('/posts/:id')
      let match = pattern.match('https://example.com/POSTS/ABC', { ignoreCase: true })
      assert.notEqual(match, null)
      assert.equal(match!.params.id, 'ABC')
    })

    it('search is always case-sensitive', () => {
      let pattern = new RoutePattern('?Sort')
      assert.notEqual(pattern.match('https://example.com?Sort'), null)
      assert.equal(pattern.match('https://example.com?sort'), null)
      assert.equal(pattern.match('https://example.com?sort', { ignoreCase: true }), null)
    })
  })
})
