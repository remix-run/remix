import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { RoutePattern } from './route-pattern.ts'
import { RegExpMatcher } from './regexp-matcher.ts'

interface TestNode {
  name: string
  handler?: string
}

describe('RegExpMatcher', () => {
  describe('constructor', () => {
    it('creates an empty matcher', () => {
      let matcher = new RegExpMatcher<TestNode>()
      assert.equal(matcher.size, 0)
    })
  })

  describe('add', () => {
    it('adds a simple static pattern', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('users', { name: 'users-handler' })

      assert.equal(matcher.size, 1)
    })

    it('adds multiple static patterns', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('users', { name: 'users' })
      matcher.add('posts', { name: 'posts' })
      matcher.add('admin', { name: 'admin' })

      assert.equal(matcher.size, 3)
    })

    it('adds patterns with variables', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('users/:id', { name: 'user-detail' })
      matcher.add('posts/:slug', { name: 'post-detail' })

      assert.equal(matcher.size, 2)
    })

    it('adds patterns with wildcards', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('files/*path', { name: 'file-handler' })
      matcher.add('assets/*', { name: 'asset-handler' })

      assert.equal(matcher.size, 2)
    })

    it('adds patterns with optionals', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('api(/:version)', { name: 'api-handler' })

      assert.equal(matcher.size, 1)
    })

    it('adds empty pattern for root', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('', { name: 'root' })

      assert.equal(matcher.size, 1)
    })

    it('adds full URL patterns', () => {
      let matcher = new RegExpMatcher<TestNode>()

      matcher.add('https://example.com/api', { name: 'api' })
      matcher.add('://api.example.com/users/:id', { name: 'api-users' })

      assert.equal(matcher.size, 2)
    })
  })

  describe('match', () => {
    describe('static patterns', () => {
      it('matches exact static pattern', () => {
        let matcher = new RegExpMatcher<TestNode>()
        matcher.add('users', { name: 'users-handler' })

        let match = matcher.match('https://example.com/users')
        assert.ok(match)
        assert.equal(match.data.name, 'users-handler')
        assert.deepEqual(match.params, {})
        assert.equal(match.url.pathname, '/users')
      })

      it('matches nested static patterns', () => {
        let matcher = new RegExpMatcher<TestNode>()
        matcher.add('api/v1/users', { name: 'api-users' })

        let match = matcher.match('https://example.com/api/v1/users')
        assert.ok(match)
        assert.equal(match.data.name, 'api-users')
        assert.deepEqual(match.params, {})
      })

      it('returns null for non-matching static pattern', () => {
        let matcher = new RegExpMatcher<TestNode>()
        matcher.add('users', { name: 'users' })

        let match = matcher.match('https://example.com/posts')
        assert.equal(match, null)
      })

      it('matches root pattern', () => {
        let matcher = new RegExpMatcher<TestNode>()
        matcher.add('', { name: 'root' })

        let match = matcher.match('https://example.com/')
        assert.ok(match)
        assert.equal(match.data.name, 'root')
        assert.deepEqual(match.params, {})
      })
    })

    describe('variable patterns', () => {
      it('matches single variable', () => {
        let matcher = new RegExpMatcher<TestNode>()
        matcher.add('users/:id', { name: 'user-detail' })

        let match = matcher.match('https://example.com/users/123')
        assert.ok(match)
        assert.equal(match.data.name, 'user-detail')
        assert.deepEqual(match.params, { id: '123' })
      })

      it('matches multiple variables', () => {
        let matcher = new RegExpMatcher<TestNode>()
        matcher.add('users/:userId/posts/:postId', { name: 'user-post' })

        let match = matcher.match('https://example.com/users/123/posts/456')
        assert.ok(match)
        assert.equal(match.data.name, 'user-post')
        assert.deepEqual(match.params, { userId: '123', postId: '456' })
      })

      it('matches variables with special characters', () => {
        let matcher = new RegExpMatcher<TestNode>()
        matcher.add('users/:id', { name: 'user' })

        let match = matcher.match('https://example.com/users/user-123_test')
        assert.ok(match)
        assert.deepEqual(match.params, { id: 'user-123_test' })
      })

      it('matches variables with URL encoding', () => {
        let matcher = new RegExpMatcher<TestNode>()
        matcher.add('search/:query', { name: 'search' })

        let match = matcher.match('https://example.com/search/hello%20world')
        assert.ok(match)
        assert.deepEqual(match.params, { query: 'hello%20world' })
      })
    })

    describe('wildcard patterns', () => {
      it('matches named wildcard', () => {
        let matcher = new RegExpMatcher<TestNode>()
        matcher.add('files/*path', { name: 'file-handler' })

        let match = matcher.match('https://example.com/files/docs/readme.txt')
        assert.ok(match)
        assert.equal(match.data.name, 'file-handler')
        assert.deepEqual(match.params, { path: 'docs/readme.txt' })
      })

      it('matches unnamed wildcard', () => {
        let matcher = new RegExpMatcher<TestNode>()
        matcher.add('assets/*', { name: 'asset-handler' })

        let match = matcher.match('https://example.com/assets/css/main.css')
        assert.ok(match)
        assert.equal(match.data.name, 'asset-handler')
        assert.deepEqual(match.params, {})
      })

      it('matches wildcard with continuation', () => {
        let matcher = new RegExpMatcher<TestNode>()
        matcher.add('proxy/*url/status', { name: 'proxy-status' })

        let match = matcher.match('https://example.com/proxy/api.example.com/v1/users/status')
        assert.ok(match)
        assert.equal(match.data.name, 'proxy-status')
        assert.deepEqual(match.params, { url: 'api.example.com/v1/users' })
      })
    })

    describe('pattern precedence', () => {
      it('prefers first matching pattern (order matters)', () => {
        let matcher = new RegExpMatcher<TestNode>()
        matcher.add('users/:id', { name: 'user-detail' })
        matcher.add('users/admin', { name: 'admin' })

        let match = matcher.match('https://example.com/users/admin')
        assert.ok(match)
        // First pattern wins in RegExpMatcher
        assert.equal(match.data.name, 'user-detail')
        assert.deepEqual(match.params, { id: 'admin' })
      })

      it('matches in registration order', () => {
        let matcher = new RegExpMatcher<TestNode>()
        matcher.add('api/:version', { name: 'api-version' })
        matcher.add('api/v1/users', { name: 'api-v1-users' })

        let match = matcher.match('https://example.com/api/v1/users')
        assert.ok(match)
        // First pattern wins but doesn't match since it's shorter
        assert.equal(match.data.name, 'api-v1-users')
        assert.deepEqual(match.params, {})
      })
    })

    describe('complex patterns', () => {
      it('matches complex mixed pattern', () => {
        let matcher = new RegExpMatcher<TestNode>()
        matcher.add('api/v:version/users/:id/posts/*path', { name: 'complex' })

        let match = matcher.match('https://example.com/api/v2/users/123/posts/2024/01/hello-world')
        assert.ok(match)
        assert.equal(match.data.name, 'complex')
        assert.deepEqual(match.params, {
          version: '2',
          id: '123',
          path: '2024/01/hello-world',
        })
      })

      it('handles multiple patterns with shared prefixes', () => {
        let matcher = new RegExpMatcher<TestNode>()
        matcher.add('api/users', { name: 'users-list' })
        matcher.add('api/users/:id', { name: 'user-detail' })
        matcher.add('api/users/:id/posts', { name: 'user-posts' })
        matcher.add('api/posts', { name: 'posts-list' })

        let match1 = matcher.match('https://example.com/api/users')
        assert.ok(match1)
        assert.equal(match1.data.name, 'users-list')

        let match2 = matcher.match('https://example.com/api/users/123')
        assert.ok(match2)
        assert.equal(match2.data.name, 'user-detail')
        assert.deepEqual(match2.params, { id: '123' })

        let match3 = matcher.match('https://example.com/api/users/123/posts')
        assert.ok(match3)
        assert.equal(match3.data.name, 'user-posts')
        assert.deepEqual(match3.params, { id: '123' })
      })
    })

    describe('edge cases', () => {
      it('handles trailing slashes consistently', () => {
        let matcher = new RegExpMatcher<TestNode>()
        matcher.add('users', { name: 'users' })

        let match1 = matcher.match('https://example.com/users')
        assert.ok(match1)
        assert.equal(match1.data.name, 'users')

        // RoutePattern doesn't match trailing slashes for exact patterns
        let match2 = matcher.match('https://example.com/users/')
        assert.equal(match2, null)
      })

      it('returns null for partial matches', () => {
        let matcher = new RegExpMatcher<TestNode>()
        matcher.add('api/v1/users', { name: 'api-users' })

        let match = matcher.match('https://example.com/api/v1')
        assert.equal(match, null)
      })
    })
  })

  describe('matchAll', () => {
    it('returns all matching patterns', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('users/:id', { name: 'user-detail' })
      matcher.add('*path', { name: 'catch-all' })

      let matches = Array.from(matcher.matchAll('https://example.com/users/123'))
      assert.equal(matches.length, 2)

      // First registered pattern comes first
      assert.equal(matches[0].data.name, 'user-detail')
      assert.deepEqual(matches[0].params, { id: '123' })

      assert.equal(matches[1].data.name, 'catch-all')
      assert.deepEqual(matches[1].params, { path: 'users/123' })
    })

    it('returns empty iterator when no matches', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('users', { name: 'users' })

      let matches = Array.from(matcher.matchAll('https://example.com/posts'))
      assert.deepEqual(matches, [])
    })
  })

  describe('optional patterns', () => {
    it('matches optional when present', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('api(/:version)', { name: 'api' })

      let match = matcher.match('https://example.com/api/v1')
      assert.ok(match)
      assert.equal(match.data.name, 'api')
      assert.deepEqual(match.params, { version: 'v1' })
    })

    it('matches optional when absent', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('api(/:version)', { name: 'api' })

      let match = matcher.match('https://example.com/api')
      assert.ok(match)
      assert.equal(match.data.name, 'api')
      assert.deepEqual(match.params, { version: undefined })
    })

    it('matches nested optionals', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('api(/:major(/:minor))', { name: 'api' })

      // All present
      let match1 = matcher.match('https://example.com/api/v2/1')
      assert.ok(match1)
      assert.deepEqual(match1.params, { major: 'v2', minor: '1' })

      // Partially present
      let match2 = matcher.match('https://example.com/api/v2')
      assert.ok(match2)
      assert.deepEqual(match2.params, { major: 'v2', minor: undefined })

      // None present
      let match3 = matcher.match('https://example.com/api')
      assert.ok(match3)
      assert.deepEqual(match3.params, { major: undefined, minor: undefined })
    })

    it('matches optional with wildcard', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('files(/*path)', { name: 'files' })

      let match1 = matcher.match('https://example.com/files/docs/readme.txt')
      assert.ok(match1)
      assert.deepEqual(match1.params, { path: 'docs/readme.txt' })

      let match2 = matcher.match('https://example.com/files')
      assert.ok(match2)
      assert.deepEqual(match2.params, { path: undefined })
    })

    it('handles multiple optional patterns', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('api(/:version)', { name: 'api-optional' })
      matcher.add('api/:version', { name: 'api-required' })

      // First pattern wins (order-dependent)
      let match = matcher.match('https://example.com/api/v1')
      assert.ok(match)
      assert.equal(match.data.name, 'api-optional')
      assert.deepEqual(match.params, { version: 'v1' })
    })

    it('matches complex optional patterns', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('users/:id(.:format)', { name: 'user' })

      let match1 = matcher.match('https://example.com/users/123.json')
      assert.ok(match1)
      assert.deepEqual(match1.params, { id: '123', format: 'json' })

      let match2 = matcher.match('https://example.com/users/123')
      assert.ok(match2)
      assert.deepEqual(match2.params, { id: '123', format: undefined })
    })
  })

  describe('full URL patterns', () => {
    it('matches protocol patterns', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('https://example.com/api', { name: 'https-api' })
      matcher.add('http://example.com/api', { name: 'http-api' })

      let match1 = matcher.match('https://example.com/api')
      assert.ok(match1)
      assert.equal(match1.data.name, 'https-api')
      assert.deepEqual(match1.params, {})

      let match2 = matcher.match('http://example.com/api')
      assert.ok(match2)
      assert.equal(match2.data.name, 'http-api')
      assert.deepEqual(match2.params, {})
    })

    it('matches any protocol patterns', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('://example.com/api', { name: 'any-protocol' })

      let match1 = matcher.match('https://example.com/api')
      assert.ok(match1)
      assert.equal(match1.data.name, 'any-protocol')

      let match2 = matcher.match('http://example.com/api')
      assert.ok(match2)
      assert.equal(match2.data.name, 'any-protocol')
    })

    it('matches hostname variables', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('https://:subdomain.example.com/api', { name: 'subdomain-api' })

      let match = matcher.match('https://api.example.com/api')
      assert.ok(match)
      assert.equal(match.data.name, 'subdomain-api')
      assert.deepEqual(match.params, { subdomain: 'api' })
    })

    it('matches hostname wildcards', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('https://*host.example.com/api', { name: 'wildcard-host' })

      let match = matcher.match('https://api.v1.example.com/api')
      assert.ok(match)
      assert.equal(match.data.name, 'wildcard-host')
      assert.deepEqual(match.params, { host: 'api.v1' })
    })

    it('matches port-specific patterns', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('://localhost:3000/api', { name: 'dev-api' })
      matcher.add('://localhost:8080/api', { name: 'prod-api' })

      let match1 = matcher.match('http://localhost:3000/api')
      assert.ok(match1)
      assert.equal(match1.data.name, 'dev-api')

      let match2 = matcher.match('https://localhost:8080/api')
      assert.ok(match2)
      assert.equal(match2.data.name, 'prod-api')
    })

    it('prefers first matching pattern (order-dependent)', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('api/users', { name: 'pathname-only' })
      matcher.add('https://example.com/api/users', { name: 'full-url' })

      let match = matcher.match('https://example.com/api/users')
      assert.ok(match)
      // First match wins
      assert.equal(match.data.name, 'pathname-only')
      assert.deepEqual(match.params, {})
    })

    it('combines protocol, hostname, and pathname parameters', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add(':protocol://:subdomain.example.com/users/:id', { name: 'complex' })

      let match = matcher.match('https://api.example.com/users/123')
      assert.ok(match)
      assert.equal(match.data.name, 'complex')
      assert.deepEqual(match.params, {
        protocol: 'https',
        subdomain: 'api',
        id: '123',
      })
    })

    it('handles case insensitivity for protocol and hostname', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('HTTPS://EXAMPLE.COM/api', { name: 'upper-case' })

      let match = matcher.match('https://example.com/api')
      assert.ok(match)
      assert.equal(match.data.name, 'upper-case')
    })

    it('supports protocol optionals like http(s)', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('http(s)://example.com/api', { name: 'http-or-https' })

      let match1 = matcher.match('http://example.com/api')
      assert.ok(match1)
      assert.equal(match1.data.name, 'http-or-https')

      let match2 = matcher.match('https://example.com/api')
      assert.ok(match2)
      assert.equal(match2.data.name, 'http-or-https')

      let match3 = matcher.match('ftp://example.com/api')
      assert.equal(match3, null)
    })

    it('supports protocol optionals with other URL components', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('http(s)://:subdomain.example.com/users/:id', { name: 'flexible-protocol' })

      let match1 = matcher.match('http://api.example.com/users/123')
      assert.ok(match1)
      assert.equal(match1.data.name, 'flexible-protocol')
      assert.deepEqual(match1.params, { subdomain: 'api', id: '123' })

      let match2 = matcher.match('https://cdn.example.com/users/456')
      assert.ok(match2)
      assert.equal(match2.data.name, 'flexible-protocol')
      assert.deepEqual(match2.params, { subdomain: 'cdn', id: '456' })
    })
  })

  describe('search constraint patterns', () => {
    it('matches patterns with search constraints', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('search?q=test', { name: 'search-test' })
      matcher.add('search?q=other', { name: 'search-other' })

      let match1 = matcher.match('https://example.com/search?q=test')
      assert.ok(match1)
      assert.equal(match1.data.name, 'search-test')

      let match2 = matcher.match('https://example.com/search?q=other')
      assert.ok(match2)
      assert.equal(match2.data.name, 'search-other')
    })

    it('returns null when search constraints not met', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('search?q=test', { name: 'search-test' })

      let match1 = matcher.match('https://example.com/search?q=wrong')
      assert.equal(match1, null)

      let match2 = matcher.match('https://example.com/search')
      assert.equal(match2, null)
    })

    it('matches bare search parameters', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('api?debug', { name: 'debug-api' })

      let match1 = matcher.match('https://example.com/api?debug')
      assert.ok(match1)
      assert.equal(match1.data.name, 'debug-api')

      let match2 = matcher.match('https://example.com/api?debug=true')
      assert.ok(match2)
      assert.equal(match2.data.name, 'debug-api')

      let match3 = matcher.match('https://example.com/api')
      assert.equal(match3, null)
    })

    it('matches required assignment parameters', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('search?q=', { name: 'search-any' })

      let match1 = matcher.match('https://example.com/search?q=test')
      assert.ok(match1)
      assert.equal(match1.data.name, 'search-any')

      let match2 = matcher.match('https://example.com/search?q=')
      assert.ok(match2)
      assert.equal(match2.data.name, 'search-any')

      let match3 = matcher.match('https://example.com/search?q')
      assert.equal(match3, null)
    })

    it('matches multiple search constraints', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('api?format=json&version=v1', { name: 'api-v1-json' })

      let match1 = matcher.match('https://example.com/api?format=json&version=v1')
      assert.ok(match1)
      assert.equal(match1.data.name, 'api-v1-json')

      let match2 = matcher.match('https://example.com/api?version=v1&format=json')
      assert.ok(match2)
      assert.equal(match2.data.name, 'api-v1-json')

      let match3 = matcher.match('https://example.com/api?format=json')
      assert.equal(match3, null)
    })

    it('matches with extra search parameters', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('search?q=test', { name: 'search-test' })

      let match = matcher.match('https://example.com/search?q=test&extra=value&utm_source=google')
      assert.ok(match)
      assert.equal(match.data.name, 'search-test')
    })

    it('combines pathname params with search constraints', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('users/:id?format=json', { name: 'user-json' })

      let match = matcher.match('https://example.com/users/123?format=json')
      assert.ok(match)
      assert.equal(match.data.name, 'user-json')
      assert.deepEqual(match.params, { id: '123' })
    })

    it('combines full URL with search constraints', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('https://:subdomain.example.com/api/:version?format=json', { name: 'api-json' })

      let match = matcher.match('https://api.example.com/api/v1?format=json')
      assert.ok(match)
      assert.equal(match.data.name, 'api-json')
      assert.deepEqual(match.params, {
        subdomain: 'api',
        version: 'v1',
      })
    })

    it('handles URL-encoded search parameters', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('search?q=hello%20world', { name: 'encoded-search' })

      let match = matcher.match('https://example.com/search?q=hello%20world')
      assert.ok(match)
      assert.equal(match.data.name, 'encoded-search')
    })

    it('handles repeated search parameter values', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('search?tags=javascript', { name: 'js-search' })

      let match = matcher.match('https://example.com/search?tags=javascript&tags=react')
      assert.ok(match)
      assert.equal(match.data.name, 'js-search')
    })
  })

  describe('comprehensive feature combinations', () => {
    it('combines all features: full URL + optionals + wildcards + search', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add(':protocol://:tenant.example.com/api(/:version)/files/*path?format=json&debug', {
        name: 'ultimate-pattern',
      })

      // With all optional parts
      let match1 = matcher.match(
        'https://acme.example.com/api/v2/files/docs/readme.txt?format=json&debug&extra=ignore',
      )
      assert.ok(match1)
      assert.equal(match1.data.name, 'ultimate-pattern')
      assert.deepEqual(match1.params, {
        protocol: 'https',
        tenant: 'acme',
        version: 'v2',
        path: 'docs/readme.txt',
      })

      // Without optional version
      let match2 = matcher.match(
        'https://acme.example.com/api/files/images/logo.png?format=json&debug=true',
      )
      assert.ok(match2)
      assert.equal(match2.data.name, 'ultimate-pattern')
      assert.deepEqual(match2.params, {
        protocol: 'https',
        tenant: 'acme',
        version: undefined,
        path: 'images/logo.png',
      })

      // Missing required search constraint
      let match3 = matcher.match('https://acme.example.com/api/files/test.txt?debug')
      assert.equal(match3, null)
    })

    it('handles complex precedence with search constraints', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('api/users', { name: 'users-any' })
      matcher.add('api/users?format=json', { name: 'users-json' })
      matcher.add('https://api.example.com/api/users', { name: 'origin-users' })
      matcher.add('https://api.example.com/api/users?format=xml', { name: 'origin-users-xml' })

      // First matching pattern wins (order-dependent)
      let match1 = matcher.match('https://api.example.com/api/users?format=xml')
      assert.ok(match1)
      assert.equal(match1.data.name, 'users-any')

      // Should match basic pathname
      let match2 = matcher.match('https://example.com/api/users')
      assert.ok(match2)
      assert.equal(match2.data.name, 'users-any')

      // Should match pathname with search constraint
      let match3 = matcher.match('https://other.com/api/users?format=json')
      assert.ok(match3)
      assert.equal(match3.data.name, 'users-any')
    })
  })

  describe('pluggable node types', () => {
    interface CustomNode {
      handler: Function
      middleware: Function[]
      metadata: { requiresAuth: boolean }
    }

    it('works with custom node types', () => {
      let matcher = new RegExpMatcher<CustomNode>()

      let handler = () => 'user data'
      let middleware = [(req: any) => req, (req: any) => req]

      matcher.add('users/:id', {
        handler,
        middleware,
        metadata: { requiresAuth: true },
      })

      let match = matcher.match('https://example.com/users/123')
      assert.ok(match)
      assert.equal(match.data.handler, handler)
      assert.equal(match.data.middleware, middleware)
      assert.equal(match.data.metadata.requiresAuth, true)
      assert.deepEqual(match.params, { id: '123' })
    })
  })

  describe('performance characteristics', () => {
    it('handles many patterns', () => {
      let matcher = new RegExpMatcher<TestNode>()

      // Add many patterns with shared prefixes
      for (let i = 0; i < 100; i++) {
        matcher.add(`api/v1/users/${i}`, { name: `user-${i}` })
        matcher.add(`api/v1/posts/${i}`, { name: `post-${i}` })
        matcher.add(`api/v2/users/${i}`, { name: `user-v2-${i}` })
      }

      assert.equal(matcher.size, 300)

      // Should still match (first wins)
      let match = matcher.match('https://example.com/api/v1/users/50')
      assert.ok(match)
      assert.equal(match.data.name, 'user-50')
    })

    it('handles deep nesting', () => {
      let matcher = new RegExpMatcher<TestNode>()

      let deepPattern = 'a/b/c/d/e/f/g/h/i/j/:id'
      matcher.add(deepPattern, { name: 'deep' })

      let match = matcher.match('https://example.com/a/b/c/d/e/f/g/h/i/j/123')
      assert.ok(match)
      assert.equal(match.data.name, 'deep')
      assert.deepEqual(match.params, { id: '123' })
    })
  })

  describe('case sensitivity', () => {
    it('matches case-sensitively by default', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('API/Users', { name: 'users' })

      let match1 = matcher.match('https://example.com/API/Users')
      assert.ok(match1)
      assert.equal(match1.data.name, 'users')

      let match2 = matcher.match('https://example.com/api/users')
      assert.equal(match2, null)
    })

    it('matches case-insensitively when pattern has ignoreCase', () => {
      let matcher = new RegExpMatcher<TestNode>()
      let pattern = new RoutePattern('API/Users', { ignoreCase: true })
      matcher.add(pattern, { name: 'users' })

      let match1 = matcher.match('https://example.com/API/Users')
      assert.ok(match1)
      assert.equal(match1.data.name, 'users')

      let match2 = matcher.match('https://example.com/api/users')
      assert.ok(match2)
      assert.equal(match2.data.name, 'users')

      let match3 = matcher.match('https://example.com/Api/Users')
      assert.ok(match3)
      assert.equal(match3.data.name, 'users')
    })

    it('mixes case-sensitive and case-insensitive patterns', () => {
      let matcher = new RegExpMatcher<TestNode>()
      matcher.add('users/Admin', { name: 'case-sensitive' })
      matcher.add(new RoutePattern('users/Settings', { ignoreCase: true }), {
        name: 'case-insensitive',
      })

      let match1 = matcher.match('https://example.com/users/Admin')
      assert.ok(match1)
      assert.equal(match1.data.name, 'case-sensitive')

      let match2 = matcher.match('https://example.com/users/admin')
      assert.equal(match2, null)

      let match3 = matcher.match('https://example.com/users/Settings')
      assert.ok(match3)
      assert.equal(match3.data.name, 'case-insensitive')

      let match4 = matcher.match('https://example.com/users/settings')
      assert.ok(match4)
      assert.equal(match4.data.name, 'case-insensitive')
    })
  })
})
