import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ArrayMatcher } from './array-matcher.ts'

describe('ArrayMatcher', () => {
  describe('match', () => {
    describe('static patterns', () => {
      it('matches exact static pattern', () => {
        let matcher = new ArrayMatcher<null>()
        matcher.add('users', null)

        let match = matcher.match('https://example.com/users')
        assert.ok(match)
        assert.deepEqual(match.params, {})
        assert.equal(match.url.pathname, '/users')
      })

      it('matches nested static patterns', () => {
        let matcher = new ArrayMatcher<null>()
        matcher.add('api/v1/users', null)

        let match = matcher.match('https://example.com/api/v1/users')
        assert.ok(match)
        assert.deepEqual(match.params, {})
      })

      it('returns null for non-matching static pattern', () => {
        let matcher = new ArrayMatcher<null>()
        matcher.add('users', null)

        let match = matcher.match('https://example.com/posts')
        assert.equal(match, null)
      })

      it('matches root pattern', () => {
        let matcher = new ArrayMatcher<null>()
        matcher.add('', null)

        let match = matcher.match('https://example.com/')
        assert.ok(match)
        assert.deepEqual(match.params, {})
      })
    })

    describe('variable patterns', () => {
      it('matches single variable', () => {
        let matcher = new ArrayMatcher<null>()
        matcher.add('users/:id', null)

        let match = matcher.match('https://example.com/users/123')
        assert.ok(match)
        assert.deepEqual(match.params, { id: '123' })
      })

      it('matches multiple variables', () => {
        let matcher = new ArrayMatcher<null>()
        matcher.add('users/:userId/posts/:postId', null)

        let match = matcher.match('https://example.com/users/123/posts/456')
        assert.ok(match)
        assert.deepEqual(match.params, { userId: '123', postId: '456' })
      })

      it('matches variables with special characters', () => {
        let matcher = new ArrayMatcher<null>()
        matcher.add('users/:id', null)

        let match = matcher.match('https://example.com/users/user-123_test')
        assert.ok(match)
        assert.deepEqual(match.params, { id: 'user-123_test' })
      })

      it('matches variables with URL encoding', () => {
        let matcher = new ArrayMatcher<null>()
        matcher.add('search/:query', null)

        let match = matcher.match('https://example.com/search/hello%20world')
        assert.ok(match)
        assert.deepEqual(match.params, { query: 'hello%20world' })
      })
    })

    describe('wildcard patterns', () => {
      it('matches named wildcard', () => {
        let matcher = new ArrayMatcher<null>()
        matcher.add('files/*path', null)

        let match = matcher.match('https://example.com/files/docs/readme.txt')
        assert.ok(match)
        assert.deepEqual(match.params, { path: 'docs/readme.txt' })
      })

      it('matches unnamed wildcard', () => {
        let matcher = new ArrayMatcher<null>()
        matcher.add('assets/*', null)

        let match = matcher.match('https://example.com/assets/css/main.css')
        assert.ok(match)
        assert.deepEqual(match.params, {})
      })

      it('matches wildcard with continuation', () => {
        let matcher = new ArrayMatcher<null>()
        matcher.add('proxy/*url/status', null)

        let match = matcher.match('https://example.com/proxy/api.example.com/v1/users/status')
        assert.ok(match)
        assert.deepEqual(match.params, { url: 'api.example.com/v1/users' })
      })
    })

    describe('complex patterns', () => {
      it('matches complex mixed pattern', () => {
        let matcher = new ArrayMatcher<null>()
        matcher.add('api/v:version/users/:id/posts/*path', null)

        let match = matcher.match('https://example.com/api/v2/users/123/posts/2024/01/hello-world')
        assert.ok(match)
        assert.deepEqual(match.params, {
          version: '2',
          id: '123',
          path: '2024/01/hello-world',
        })
      })

      it('handles multiple patterns with shared prefixes', () => {
        let matcher = new ArrayMatcher<null>()
        matcher.add('api/users', null)
        matcher.add('api/users/:id', null)
        matcher.add('api/users/:id/posts', null)
        matcher.add('api/posts', null)

        let match1 = matcher.match('https://example.com/api/users')
        assert.ok(match1)

        let match2 = matcher.match('https://example.com/api/users/123')
        assert.ok(match2)
        assert.deepEqual(match2.params, { id: '123' })

        let match3 = matcher.match('https://example.com/api/users/123/posts')
        assert.ok(match3)
        assert.deepEqual(match3.params, { id: '123' })
      })
    })

    describe('edge cases', () => {
      it('handles trailing slashes consistently', () => {
        let matcher = new ArrayMatcher<null>()
        matcher.add('users', null)

        let match1 = matcher.match('https://example.com/users')
        assert.ok(match1)

        // RoutePattern doesn't match trailing slashes for exact patterns
        let match2 = matcher.match('https://example.com/users/')
        assert.equal(match2, null)
      })

      it('returns null for partial matches', () => {
        let matcher = new ArrayMatcher<null>()
        matcher.add('api/v1/users', null)

        let match = matcher.match('https://example.com/api/v1')
        assert.equal(match, null)
      })
    })
  })

  describe('matchAll', () => {
    it('returns all matching patterns', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('users/:id', null)
      matcher.add('*path', null)

      let matches = matcher.matchAll('https://example.com/users/123')
      assert.equal(matches.length, 2)

      // First registered pattern comes first
      assert.deepEqual(matches[0].params, { id: '123' })

      assert.deepEqual(matches[1].params, { path: 'users/123' })
    })

    it('returns empty array when no matches', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('users', null)

      let matches = matcher.matchAll('https://example.com/posts')
      assert.deepEqual(matches, [])
    })
  })

  describe('optional patterns', () => {
    it('matches optional when present', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('api(/:version)', null)

      let match = matcher.match('https://example.com/api/v1')
      assert.ok(match)
      assert.deepEqual(match.params, { version: 'v1' })
    })

    it('matches optional when absent', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('api(/:version)', null)

      let match = matcher.match('https://example.com/api')
      assert.ok(match)
      assert.deepEqual(match.params, { version: undefined })
    })

    it('matches nested optionals', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('api(/:major(/:minor))', null)

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
      let matcher = new ArrayMatcher<null>()
      matcher.add('files(/*path)', null)

      let match1 = matcher.match('https://example.com/files/docs/readme.txt')
      assert.ok(match1)
      assert.deepEqual(match1.params, { path: 'docs/readme.txt' })

      let match2 = matcher.match('https://example.com/files')
      assert.ok(match2)
      assert.deepEqual(match2.params, { path: undefined })
    })

    it('handles multiple optional patterns', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('api(/:version)', null)
      matcher.add('api/:version', null)

      // First pattern wins (order-dependent)
      let match = matcher.match('https://example.com/api/v1')
      assert.ok(match)
      assert.deepEqual(match.params, { version: 'v1' })
    })

    it('matches complex optional patterns', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('users/:id(.:format)', null)

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
      let matcher = new ArrayMatcher<null>()
      matcher.add('https://example.com/api', null)
      matcher.add('http://example.com/api', null)

      let match1 = matcher.match('https://example.com/api')
      assert.ok(match1)
      assert.deepEqual(match1.params, {})

      let match2 = matcher.match('http://example.com/api')
      assert.ok(match2)
      assert.deepEqual(match2.params, {})
    })

    it('matches any protocol patterns', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('://example.com/api', null)

      let match1 = matcher.match('https://example.com/api')
      assert.ok(match1)

      let match2 = matcher.match('http://example.com/api')
      assert.ok(match2)
    })

    it('matches hostname variables', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('https://:subdomain.example.com/api', null)

      let match = matcher.match('https://api.example.com/api')
      assert.ok(match)
      assert.deepEqual(match.params, { subdomain: 'api' })
    })

    it('matches hostname wildcards', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('https://*host.example.com/api', null)

      let match = matcher.match('https://api.v1.example.com/api')
      assert.ok(match)
      assert.deepEqual(match.params, { host: 'api.v1' })
    })

    it('matches port-specific patterns', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('://localhost:3000/api', null)
      matcher.add('://localhost:8080/api', null)

      let match1 = matcher.match('http://localhost:3000/api')
      assert.ok(match1)

      let match2 = matcher.match('https://localhost:8080/api')
      assert.ok(match2)
    })

    it('prefers first matching pattern (order-dependent)', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('api/users', null)
      matcher.add('https://example.com/api/users', null)

      let match = matcher.match('https://example.com/api/users')
      assert.ok(match)
      // First match wins
      assert.deepEqual(match.params, {})
    })

    it('supports protocol optionals like http(s)', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('http(s)://example.com/api', null)

      let match1 = matcher.match('http://example.com/api')
      assert.ok(match1)

      let match2 = matcher.match('https://example.com/api')
      assert.ok(match2)

      let match3 = matcher.match('ftp://example.com/api')
      assert.equal(match3, null)
    })

    it('supports protocol optionals with other URL components', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('http(s)://:subdomain.example.com/users/:id', null)

      let match1 = matcher.match('http://api.example.com/users/123')
      assert.ok(match1)
      assert.deepEqual(match1.params, { subdomain: 'api', id: '123' })

      let match2 = matcher.match('https://cdn.example.com/users/456')
      assert.ok(match2)
      assert.deepEqual(match2.params, { subdomain: 'cdn', id: '456' })
    })
  })

  describe('search constraint patterns', () => {
    it('matches patterns with search constraints', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('search?q=test', null)
      matcher.add('search?q=other', null)

      let match1 = matcher.match('https://example.com/search?q=test')
      assert.ok(match1)

      let match2 = matcher.match('https://example.com/search?q=other')
      assert.ok(match2)
    })

    it('returns null when search constraints not met', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('search?q=test', null)

      let match1 = matcher.match('https://example.com/search?q=wrong')
      assert.equal(match1, null)

      let match2 = matcher.match('https://example.com/search')
      assert.equal(match2, null)
    })

    it('matches bare search parameters', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('api?debug', null)

      let match1 = matcher.match('https://example.com/api?debug')
      assert.ok(match1)

      let match2 = matcher.match('https://example.com/api?debug=true')
      assert.ok(match2)

      let match3 = matcher.match('https://example.com/api')
      assert.equal(match3, null)
    })

    it('matches required assignment parameters', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('search?q=', null)

      let match1 = matcher.match('https://example.com/search?q=test')
      assert.ok(match1)

      let match2 = matcher.match('https://example.com/search?q=')
      assert.equal(match2, null)

      let match3 = matcher.match('https://example.com/search?q')
      assert.equal(match3, null)
    })

    it('matches multiple search constraints', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('api?format=json&version=v1', null)

      let match1 = matcher.match('https://example.com/api?format=json&version=v1')
      assert.ok(match1)

      let match2 = matcher.match('https://example.com/api?version=v1&format=json')
      assert.ok(match2)

      let match3 = matcher.match('https://example.com/api?format=json')
      assert.equal(match3, null)
    })

    it('matches with extra search parameters', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('search?q=test', null)

      let match = matcher.match('https://example.com/search?q=test&extra=value&utm_source=google')
      assert.ok(match)
    })

    it('combines pathname params with search constraints', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('users/:id?format=json', null)

      let match = matcher.match('https://example.com/users/123?format=json')
      assert.ok(match)
      assert.deepEqual(match.params, { id: '123' })
    })

    it('combines full URL with search constraints', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('https://:subdomain.example.com/api/:version?format=json', null)

      let match = matcher.match('https://api.example.com/api/v1?format=json')
      assert.ok(match)
      assert.deepEqual(match.params, {
        subdomain: 'api',
        version: 'v1',
      })
    })

    it('handles URL-encoded search parameters', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('search?q=hello%20world', null)

      let match = matcher.match('https://example.com/search?q=hello%20world')
      assert.ok(match)
    })

    it('handles repeated search parameter values', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('search?tags=javascript', null)

      let match = matcher.match('https://example.com/search?tags=javascript&tags=react')
      assert.ok(match)
    })
  })

  describe('comprehensive feature combinations', () => {
    it('handles complex precedence with search constraints', () => {
      let matcher = new ArrayMatcher<null>()
      matcher.add('api/users', null)
      matcher.add('api/users?format=json', null)
      matcher.add('https://api.example.com/api/users', null)
      matcher.add('https://api.example.com/api/users?format=xml', null)

      // First matching pattern wins (order-dependent)
      let match1 = matcher.match('https://api.example.com/api/users?format=xml')
      assert.ok(match1)

      // Should match basic pathname
      let match2 = matcher.match('https://example.com/api/users')
      assert.ok(match2)

      // Should match pathname with search constraint
      let match3 = matcher.match('https://other.com/api/users?format=json')
      assert.ok(match3)
    })
  })

  describe('performance characteristics', () => {
    it('handles deep nesting', () => {
      let matcher = new ArrayMatcher<null>()

      let deepPattern = 'a/b/c/d/e/f/g/h/i/j/:id'
      matcher.add(deepPattern, null)

      let match = matcher.match('https://example.com/a/b/c/d/e/f/g/h/i/j/123')
      assert.ok(match)
      assert.deepEqual(match.params, { id: '123' })
    })
  })
})
