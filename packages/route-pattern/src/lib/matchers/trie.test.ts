import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { RoutePattern } from '../route-pattern.ts'
import { TrieMatcher } from './trie.ts'

interface TestNode {
  name: string
  handler?: string
}

describe('TrieMatcher', () => {
  describe('constructor', () => {
    it('creates an empty trie', () => {
      let trie = new TrieMatcher<TestNode>()
      assert.equal(trie.size, 0)
    })
  })

  describe('add', () => {
    it('adds a simple static pattern', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('users', { name: 'users-handler' })

      assert.equal(trie.size, 1)
    })

    it('adds multiple static patterns', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('users', { name: 'users' })
      trie.add('posts', { name: 'posts' })
      trie.add('admin', { name: 'admin' })

      assert.equal(trie.size, 3)
    })

    it('adds patterns with variables', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('users/:id', { name: 'user-detail' })
      trie.add('posts/:slug', { name: 'post-detail' })

      assert.equal(trie.size, 2)
    })

    it('adds patterns with wildcards', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('files/*path', { name: 'file-handler' })
      trie.add('assets/*', { name: 'asset-handler' })

      assert.equal(trie.size, 2)
    })

    it('adds patterns with optionals', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('api(/:version)', { name: 'api-handler' })

      assert.equal(trie.size, 1)
    })

    it('adds empty pattern for root', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('', { name: 'root' })

      assert.equal(trie.size, 1)
    })

    it('adds full URL patterns', () => {
      let trie = new TrieMatcher<TestNode>()

      trie.add('https://example.com/api', { name: 'api' })
      trie.add('://api.example.com/users/:id', { name: 'api-users' })

      assert.equal(trie.size, 2)
    })
  })

  describe('match', () => {
    describe('static patterns', () => {
      it('matches exact static pattern', () => {
        let trie = new TrieMatcher<TestNode>()
        trie.add('users', { name: 'users-handler' })

        let match = trie.match('https://example.com/users')
        assert.ok(match)
        assert.equal(match.data.name, 'users-handler')
        assert.deepEqual(match.params, {})
        assert.equal(match.url.pathname, '/users')
      })

      it('matches nested static patterns', () => {
        let trie = new TrieMatcher<TestNode>()
        trie.add('api/v1/users', { name: 'api-users' })

        let match = trie.match('https://example.com/api/v1/users')
        assert.ok(match)
        assert.equal(match.data.name, 'api-users')
        assert.deepEqual(match.params, {})
      })

      it('returns null for non-matching static pattern', () => {
        let trie = new TrieMatcher<TestNode>()
        trie.add('users', { name: 'users' })

        let match = trie.match('https://example.com/posts')
        assert.equal(match, null)
      })

      it('matches root pattern', () => {
        let trie = new TrieMatcher<TestNode>()
        trie.add('', { name: 'root' })

        let match = trie.match('https://example.com/')
        assert.ok(match)
        assert.equal(match.data.name, 'root')
        assert.deepEqual(match.params, {})
      })
    })

    describe('variable patterns', () => {
      it('matches single variable', () => {
        let trie = new TrieMatcher<TestNode>()
        trie.add('users/:id', { name: 'user-detail' })

        let match = trie.match('https://example.com/users/123')
        assert.ok(match)
        assert.equal(match.data.name, 'user-detail')
        assert.deepEqual(match.params, { id: '123' })
      })

      it('matches multiple variables', () => {
        let trie = new TrieMatcher<TestNode>()
        trie.add('users/:userId/posts/:postId', { name: 'user-post' })

        let match = trie.match('https://example.com/users/123/posts/456')
        assert.ok(match)
        assert.equal(match.data.name, 'user-post')
        assert.deepEqual(match.params, { userId: '123', postId: '456' })
      })

      it('matches variables with special characters', () => {
        let trie = new TrieMatcher<TestNode>()
        trie.add('users/:id', { name: 'user' })

        let match = trie.match('https://example.com/users/user-123_test')
        assert.ok(match)
        assert.deepEqual(match.params, { id: 'user-123_test' })
      })

      it('matches variables with URL encoding', () => {
        let trie = new TrieMatcher<TestNode>()
        trie.add('search/:query', { name: 'search' })

        let match = trie.match('https://example.com/search/hello%20world')
        assert.ok(match)
        assert.deepEqual(match.params, { query: 'hello%20world' })
      })
    })

    describe('wildcard patterns', () => {
      it('matches named wildcard', () => {
        let trie = new TrieMatcher<TestNode>()
        trie.add('files/*path', { name: 'file-handler' })

        let match = trie.match('https://example.com/files/docs/readme.txt')
        assert.ok(match)
        assert.equal(match.data.name, 'file-handler')
        assert.deepEqual(match.params, { path: 'docs/readme.txt' })
      })

      it('matches unnamed wildcard', () => {
        let trie = new TrieMatcher<TestNode>()
        trie.add('assets/*', { name: 'asset-handler' })

        let match = trie.match('https://example.com/assets/css/main.css')
        assert.ok(match)
        assert.equal(match.data.name, 'asset-handler')
        assert.deepEqual(match.params, {})
      })

      it('matches wildcard with continuation', () => {
        let trie = new TrieMatcher<TestNode>()
        trie.add('proxy/*url/status', { name: 'proxy-status' })

        let match = trie.match('https://example.com/proxy/api.example.com/v1/users/status')
        assert.ok(match)
        assert.equal(match.data.name, 'proxy-status')
        assert.deepEqual(match.params, { url: 'api.example.com/v1/users' })
      })
    })

    describe('pattern precedence', () => {
      it('prefers static over variable', () => {
        let trie = new TrieMatcher<TestNode>()
        trie.add('users/:id', { name: 'user-detail' })
        trie.add('users/admin', { name: 'admin' })

        let match = trie.match('https://example.com/users/admin')
        assert.ok(match)
        assert.equal(match.data.name, 'admin')
        assert.deepEqual(match.params, {})
      })

      it('prefers variable over wildcard', () => {
        let trie = new TrieMatcher<TestNode>()
        trie.add('files/*path', { name: 'wildcard' })
        trie.add('files/:filename', { name: 'variable' })

        let match = trie.match('https://example.com/files/readme.txt')
        assert.ok(match)
        assert.equal(match.data.name, 'variable')
        assert.deepEqual(match.params, { filename: 'readme.txt' })
      })

      it('prefers more specific patterns', () => {
        let trie = new TrieMatcher<TestNode>()
        trie.add('api/:version', { name: 'api-version' })
        trie.add('api/v1/users', { name: 'api-v1-users' })

        let match = trie.match('https://example.com/api/v1/users')
        assert.ok(match)
        assert.equal(match.data.name, 'api-v1-users')
        assert.deepEqual(match.params, {})
      })
    })

    describe('complex patterns', () => {
      it('matches complex mixed pattern', () => {
        let trie = new TrieMatcher<TestNode>()
        trie.add('api/v:version/users/:id/posts/*path', { name: 'complex' })

        let match = trie.match('https://example.com/api/v2/users/123/posts/2024/01/hello-world')
        assert.ok(match)
        assert.equal(match.data.name, 'complex')
        assert.deepEqual(match.params, {
          version: '2',
          id: '123',
          path: '2024/01/hello-world',
        })
      })

      it('handles multiple patterns with shared prefixes', () => {
        let trie = new TrieMatcher<TestNode>()
        trie.add('api/users', { name: 'users-list' })
        trie.add('api/users/:id', { name: 'user-detail' })
        trie.add('api/users/:id/posts', { name: 'user-posts' })
        trie.add('api/posts', { name: 'posts-list' })

        let match1 = trie.match('https://example.com/api/users')
        assert.ok(match1)
        assert.equal(match1.data.name, 'users-list')

        let match2 = trie.match('https://example.com/api/users/123')
        assert.ok(match2)
        assert.equal(match2.data.name, 'user-detail')
        assert.deepEqual(match2.params, { id: '123' })

        let match3 = trie.match('https://example.com/api/users/123/posts')
        assert.ok(match3)
        assert.equal(match3.data.name, 'user-posts')
        assert.deepEqual(match3.params, { id: '123' })
      })
    })

    describe('edge cases', () => {
      it('handles trailing slashes consistently', () => {
        let trie = new TrieMatcher<TestNode>()
        trie.add('users', { name: 'users' })

        let match1 = trie.match('https://example.com/users')
        let match2 = trie.match('https://example.com/users/')

        assert.ok(match1)
        assert.ok(match2)
        assert.equal(match1.data.name, match2.data.name)
      })

      it('handles empty segments', () => {
        let trie = new TrieMatcher<TestNode>()
        trie.add('api//users', { name: 'api-users' })

        let match = trie.match('https://example.com/api//users')
        assert.ok(match)
        assert.equal(match.data.name, 'api-users')
      })

      it('returns null for partial matches', () => {
        let trie = new TrieMatcher<TestNode>()
        trie.add('api/v1/users', { name: 'api-users' })

        let match = trie.match('https://example.com/api/v1')
        assert.equal(match, null)
      })
    })
  })

  describe('matchAll', () => {
    it('returns all matching patterns', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('users/:id', { name: 'user-detail' })
      trie.add('*path', { name: 'catch-all' })

      let matches = Array.from(trie.matchAll('https://example.com/users/123'))
      assert.equal(matches.length, 2)

      // Should be sorted by specificity
      assert.equal(matches[0].data.name, 'user-detail')
      assert.deepEqual(matches[0].params, { id: '123' })

      assert.equal(matches[1].data.name, 'catch-all')
      assert.deepEqual(matches[1].params, { path: 'users/123' })
    })

    it('returns empty array when no matches', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('users', { name: 'users' })

      let matches = Array.from(trie.matchAll('https://example.com/posts'))
      assert.deepEqual(matches, [])
    })
  })

  describe('optional patterns', () => {
    it('matches optional when present', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('api(/:version)', { name: 'api' })

      let match = trie.match('https://example.com/api/v1')
      assert.ok(match)
      assert.equal(match.data.name, 'api')
      assert.deepEqual(match.params, { version: 'v1' })
    })

    it('matches optional when absent', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('api(/:version)', { name: 'api' })

      let match = trie.match('https://example.com/api')
      assert.ok(match)
      assert.equal(match.data.name, 'api')
      assert.deepEqual(match.params, {})
    })

    it('matches nested optionals', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('api(/:major(/:minor))', { name: 'api' })

      // All present
      let match1 = trie.match('https://example.com/api/v2/1')
      assert.ok(match1)
      assert.deepEqual(match1.params, { major: 'v2', minor: '1' })

      // Partially present
      let match2 = trie.match('https://example.com/api/v2')
      assert.ok(match2)
      assert.deepEqual(match2.params, { major: 'v2' })

      // None present
      let match3 = trie.match('https://example.com/api')
      assert.ok(match3)
      assert.deepEqual(match3.params, {})
    })

    it('matches optional with wildcard', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('files(/*path)', { name: 'files' })

      let match1 = trie.match('https://example.com/files/docs/readme.txt')
      assert.ok(match1)
      assert.deepEqual(match1.params, { path: 'docs/readme.txt' })

      let match2 = trie.match('https://example.com/files')
      assert.ok(match2)
      assert.deepEqual(match2.params, {})
    })

    it('handles multiple optional patterns', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('api(/:version)', { name: 'api-optional' })
      trie.add('api/:version', { name: 'api-required' })

      // Should prefer the required version (more specific)
      let match = trie.match('https://example.com/api/v1')
      assert.ok(match)
      assert.equal(match.data.name, 'api-required')
      assert.deepEqual(match.params, { version: 'v1' })
    })

    it('matches complex optional patterns', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('users/:id(.:format)', { name: 'user' })

      let match1 = trie.match('https://example.com/users/123.json')
      assert.ok(match1)
      assert.deepEqual(match1.params, { id: '123', format: 'json' })

      let match2 = trie.match('https://example.com/users/123')
      assert.ok(match2)
      assert.deepEqual(match2.params, { id: '123' })
    })
  })

  describe('full URL patterns', () => {
    it('matches protocol patterns', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('https://example.com/api', { name: 'https-api' })
      trie.add('http://example.com/api', { name: 'http-api' })

      let match1 = trie.match('https://example.com/api')
      assert.ok(match1)
      assert.equal(match1.data.name, 'https-api')
      assert.deepEqual(match1.params, {})

      let match2 = trie.match('http://example.com/api')
      assert.ok(match2)
      assert.equal(match2.data.name, 'http-api')
      assert.deepEqual(match2.params, {})
    })

    it('matches any protocol patterns', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('://example.com/api', { name: 'any-protocol' })

      let match1 = trie.match('https://example.com/api')
      assert.ok(match1)
      assert.equal(match1.data.name, 'any-protocol')

      let match2 = trie.match('http://example.com/api')
      assert.ok(match2)
      assert.equal(match2.data.name, 'any-protocol')
    })

    it('matches hostname variables', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('https://:subdomain.example.com/api', { name: 'subdomain-api' })

      let match = trie.match('https://api.example.com/api')
      assert.ok(match)
      assert.equal(match.data.name, 'subdomain-api')
      assert.deepEqual(match.params, { subdomain: 'api' })
    })

    it('matches hostname wildcards', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('https://*host.example.com/api', { name: 'wildcard-host' })

      let match = trie.match('https://api.v1.example.com/api')
      assert.ok(match)
      assert.equal(match.data.name, 'wildcard-host')
      assert.deepEqual(match.params, { host: 'api.v1' })
    })

    it('matches port-specific patterns', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('://localhost:3000/api', { name: 'dev-api' })
      trie.add('://localhost:8080/api', { name: 'prod-api' })

      let match1 = trie.match('http://localhost:3000/api')
      assert.ok(match1)
      assert.equal(match1.data.name, 'dev-api')

      let match2 = trie.match('https://localhost:8080/api')
      assert.ok(match2)
      assert.equal(match2.data.name, 'prod-api')
    })

    it('prefers origin patterns over pathname patterns', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('api/users', { name: 'pathname-only' })
      trie.add('https://example.com/api/users', { name: 'full-url' })

      let match = trie.match('https://example.com/api/users')
      assert.ok(match)
      assert.equal(match.data.name, 'full-url')
      assert.deepEqual(match.params, {})
    })

    it('combines protocol, hostname, and pathname parameters', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add(':protocol://:subdomain.example.com/users/:id', { name: 'complex' })

      let match = trie.match('https://api.example.com/users/123')
      assert.ok(match)
      assert.equal(match.data.name, 'complex')
      assert.deepEqual(match.params, {
        protocol: 'https',
        subdomain: 'api',
        id: '123',
      })
    })

    it('handles case insensitivity for protocol and hostname', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('HTTPS://EXAMPLE.COM/api', { name: 'upper-case' })

      let match = trie.match('https://example.com/api')
      assert.ok(match)
      assert.equal(match.data.name, 'upper-case')
    })

    it('supports protocol optionals like http(s)', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('http(s)://example.com/api', { name: 'http-or-https' })

      let match1 = trie.match('http://example.com/api')
      assert.ok(match1)
      assert.equal(match1.data.name, 'http-or-https')

      let match2 = trie.match('https://example.com/api')
      assert.ok(match2)
      assert.equal(match2.data.name, 'http-or-https')

      let match3 = trie.match('ftp://example.com/api')
      assert.equal(match3, null)
    })

    it('supports protocol optionals with other URL components', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('http(s)://:subdomain.example.com/users/:id', { name: 'flexible-protocol' })

      let match1 = trie.match('http://api.example.com/users/123')
      assert.ok(match1)
      assert.equal(match1.data.name, 'flexible-protocol')
      assert.deepEqual(match1.params, { subdomain: 'api', id: '123' })

      let match2 = trie.match('https://cdn.example.com/users/456')
      assert.ok(match2)
      assert.equal(match2.data.name, 'flexible-protocol')
      assert.deepEqual(match2.params, { subdomain: 'cdn', id: '456' })
    })
  })

  describe('search constraint patterns', () => {
    it('matches patterns with search constraints', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('search?q=test', { name: 'search-test' })
      trie.add('search?q=other', { name: 'search-other' })

      let match1 = trie.match('https://example.com/search?q=test')
      assert.ok(match1)
      assert.equal(match1.data.name, 'search-test')

      let match2 = trie.match('https://example.com/search?q=other')
      assert.ok(match2)
      assert.equal(match2.data.name, 'search-other')
    })

    it('returns null when search constraints not met', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('search?q=test', { name: 'search-test' })

      let match1 = trie.match('https://example.com/search?q=wrong')
      assert.equal(match1, null)

      let match2 = trie.match('https://example.com/search')
      assert.equal(match2, null)
    })

    it('matches bare search parameters', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('api?debug', { name: 'debug-api' })

      let match1 = trie.match('https://example.com/api?debug')
      assert.ok(match1)
      assert.equal(match1.data.name, 'debug-api')

      let match2 = trie.match('https://example.com/api?debug=true')
      assert.ok(match2)
      assert.equal(match2.data.name, 'debug-api')

      let match3 = trie.match('https://example.com/api')
      assert.equal(match3, null)
    })

    it('matches required assignment parameters', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('search?q=', { name: 'search-any' })

      let match1 = trie.match('https://example.com/search?q=test')
      assert.ok(match1)
      assert.equal(match1.data.name, 'search-any')

      let match2 = trie.match('https://example.com/search?q=')
      assert.ok(match2)
      assert.equal(match2.data.name, 'search-any')

      let match3 = trie.match('https://example.com/search?q')
      assert.equal(match3, null)
    })

    it('matches multiple search constraints', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('api?format=json&version=v1', { name: 'api-v1-json' })

      let match1 = trie.match('https://example.com/api?format=json&version=v1')
      assert.ok(match1)
      assert.equal(match1.data.name, 'api-v1-json')

      let match2 = trie.match('https://example.com/api?version=v1&format=json')
      assert.ok(match2)
      assert.equal(match2.data.name, 'api-v1-json')

      let match3 = trie.match('https://example.com/api?format=json')
      assert.equal(match3, null)
    })

    it('matches with extra search parameters', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('search?q=test', { name: 'search-test' })

      let match = trie.match('https://example.com/search?q=test&extra=value&utm_source=google')
      assert.ok(match)
      assert.equal(match.data.name, 'search-test')
    })

    it('combines pathname params with search constraints', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('users/:id?format=json', { name: 'user-json' })

      let match = trie.match('https://example.com/users/123?format=json')
      assert.ok(match)
      assert.equal(match.data.name, 'user-json')
      assert.deepEqual(match.params, { id: '123' })
    })

    it('combines full URL with search constraints', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('https://:subdomain.example.com/api/:version?format=json', { name: 'api-json' })

      let match = trie.match('https://api.example.com/api/v1?format=json')
      assert.ok(match)
      assert.equal(match.data.name, 'api-json')
      assert.deepEqual(match.params, {
        subdomain: 'api',
        version: 'v1',
      })
    })

    it('handles URL-encoded search parameters', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('search?q=hello%20world', { name: 'encoded-search' })

      let match = trie.match('https://example.com/search?q=hello%20world')
      assert.ok(match)
      assert.equal(match.data.name, 'encoded-search')
    })

    it('handles repeated search parameter values', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('search?tags=javascript', { name: 'js-search' })

      let match = trie.match('https://example.com/search?tags=javascript&tags=react')
      assert.ok(match)
      assert.equal(match.data.name, 'js-search')
    })
  })

  describe('comprehensive feature combinations', () => {
    it('combines all features: full URL + optionals + wildcards + search', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add(':protocol://:tenant.example.com/api(/:version)/files/*path?format=json&debug', {
        name: 'ultimate-pattern',
      })

      // With all optional parts
      let match1 = trie.match(
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
      let match2 = trie.match(
        'https://acme.example.com/api/files/images/logo.png?format=json&debug=true',
      )
      assert.ok(match2)
      assert.equal(match2.data.name, 'ultimate-pattern')
      assert.deepEqual(match2.params, {
        protocol: 'https',
        tenant: 'acme',
        path: 'images/logo.png',
      })

      // Missing required search constraint
      let match3 = trie.match('https://acme.example.com/api/files/test.txt?debug')
      assert.equal(match3, null)
    })

    it('handles complex precedence with search constraints', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('api/users', { name: 'users-any' })
      trie.add('api/users?format=json', { name: 'users-json' })
      trie.add('https://api.example.com/api/users', { name: 'origin-users' })
      trie.add('https://api.example.com/api/users?format=xml', { name: 'origin-users-xml' })

      // Should match most specific: origin + search constraint
      let match1 = trie.match('https://api.example.com/api/users?format=xml')
      assert.ok(match1)
      assert.equal(match1.data.name, 'origin-users-xml')

      // Should match origin without search constraint
      let match2 = trie.match('https://api.example.com/api/users')
      assert.ok(match2)
      assert.equal(match2.data.name, 'origin-users')

      // Should match pathname with search constraint
      let match3 = trie.match('https://other.com/api/users?format=json')
      assert.ok(match3)
      assert.equal(match3.data.name, 'users-json')

      // Should match basic pathname
      let match4 = trie.match('https://other.com/api/users')
      assert.ok(match4)
      assert.equal(match4.data.name, 'users-any')
    })
  })

  describe('pluggable node types', () => {
    interface CustomNode {
      handler: Function
      middleware: Function[]
      metadata: { requiresAuth: boolean }
    }

    it('works with custom node types', () => {
      let trie = new TrieMatcher<CustomNode>()

      let handler = () => 'user data'
      let middleware = [(req: any) => req, (req: any) => req]

      trie.add('users/:id', {
        handler,
        middleware,
        metadata: { requiresAuth: true },
      })

      let match = trie.match('https://example.com/users/123')
      assert.ok(match)
      assert.equal(match.data.handler, handler)
      assert.equal(match.data.middleware, middleware)
      assert.equal(match.data.metadata.requiresAuth, true)
      assert.deepEqual(match.params, { id: '123' })
    })
  })

  describe('performance characteristics', () => {
    it('handles many patterns efficiently', () => {
      let trie = new TrieMatcher<TestNode>()

      // Add many patterns with shared prefixes
      for (let i = 0; i < 100; i++) {
        trie.add(`api/v1/users/${i}`, { name: `user-${i}` })
        trie.add(`api/v1/posts/${i}`, { name: `post-${i}` })
        trie.add(`api/v2/users/${i}`, { name: `user-v2-${i}` })
      }

      assert.equal(trie.size, 300)

      // Should still match efficiently
      let match = trie.match('https://example.com/api/v1/users/50')
      assert.ok(match)
      assert.equal(match.data.name, 'user-50')
    })

    it('handles deep nesting', () => {
      let trie = new TrieMatcher<TestNode>()

      let deepPattern = 'a/b/c/d/e/f/g/h/i/j/:id'
      trie.add(deepPattern, { name: 'deep' })

      let match = trie.match('https://example.com/a/b/c/d/e/f/g/h/i/j/123')
      assert.ok(match)
      assert.equal(match.data.name, 'deep')
      assert.deepEqual(match.params, { id: '123' })
    })

    it('fast-tracks pure static paths', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('static/a/b/c/d/e/f', { name: 'static-long' })
      let match = trie.match('https://example.com/static/a/b/c/d/e/f')
      assert.ok(match)
      assert.equal(match.data.name, 'static-long')
      assert.deepEqual(match.params, {})
    })

    it('falls back to traversal for mixed static/var', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('static/a/:id', { name: 'mixed' })
      let match = trie.match('https://example.com/static/a/123')
      assert.ok(match)
      assert.equal(match.data.name, 'mixed')
      assert.deepEqual(match.params, { id: '123' })
    })

    it('fast-tracks static with case-insensitive fallback', () => {
      let trie = new TrieMatcher<TestNode>()
      let pattern = new RoutePattern('Static/A/B', { ignoreCase: true })
      trie.add(pattern, { name: 'case-insensitive-static' })
      let match = trie.match('https://example.com/static/a/b')
      assert.ok(match)
      assert.equal(match.data.name, 'case-insensitive-static')
      assert.deepEqual(match.params, {})
    })

    it('does not match static case-insensitively if no ignoreCase', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('Static/A/B', { name: 'case-sensitive-static' })
      let match = trie.match('https://example.com/static/a/b')
      assert.equal(match, null)
      let exactMatch = trie.match('https://example.com/Static/A/B')
      assert.ok(exactMatch)
      assert.equal(exactMatch.data.name, 'case-sensitive-static')
    })
  })

  describe('maxOptionalDepth enforcement', () => {
    it('throws when optional nesting exceeds maxOptionalDepth', () => {
      let trie = new TrieMatcher<TestNode>({ maxOptionalDepth: 2 })

      // Depth 3 (exceeds 2): api(/v1(/v2(/v3)))
      assert.throws(() => {
        trie.add('api(/v1(/v2(/v3)))', { name: 'too-deep' })
      })
    })

    it('allows patterns within the depth limit', () => {
      let trie = new TrieMatcher<TestNode>({ maxOptionalDepth: 3 })
      // Depth 3 is allowed here
      trie.add('api(/v1(/v2(/v3)))', { name: 'ok' })

      let match = trie.match('https://example.com/api/v1/v2/v3')
      assert.ok(match)
      assert.equal(match?.data.name, 'ok')
    })
  })

  describe('case sensitivity', () => {
    it('matches case-sensitively by default', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('API/Users', { name: 'users' })

      let match1 = trie.match('https://example.com/API/Users')
      assert.ok(match1)
      assert.equal(match1.data.name, 'users')

      let match2 = trie.match('https://example.com/api/users')
      assert.equal(match2, null)
    })

    it('matches case-insensitively when pattern has ignoreCase', () => {
      let trie = new TrieMatcher<TestNode>()
      let pattern = new RoutePattern('API/Users', { ignoreCase: true })
      trie.add(pattern, { name: 'users' })

      let match1 = trie.match('https://example.com/API/Users')
      assert.ok(match1)
      assert.equal(match1.data.name, 'users')

      let match2 = trie.match('https://example.com/api/users')
      assert.ok(match2)
      assert.equal(match2.data.name, 'users')

      let match3 = trie.match('https://example.com/Api/Users')
      assert.ok(match3)
      assert.equal(match3.data.name, 'users')
    })

    it('mixes case-sensitive and case-insensitive patterns', () => {
      let trie = new TrieMatcher<TestNode>()
      trie.add('users/Admin', { name: 'case-sensitive' })
      trie.add(new RoutePattern('users/Settings', { ignoreCase: true }), {
        name: 'case-insensitive',
      })

      let match1 = trie.match('https://example.com/users/Admin')
      assert.ok(match1)
      assert.equal(match1.data.name, 'case-sensitive')

      let match2 = trie.match('https://example.com/users/admin')
      assert.equal(match2, null)

      let match3 = trie.match('https://example.com/users/Settings')
      assert.ok(match3)
      assert.equal(match3.data.name, 'case-insensitive')

      let match4 = trie.match('https://example.com/users/settings')
      assert.ok(match4)
      assert.equal(match4.data.name, 'case-insensitive')
    })
  })
})
