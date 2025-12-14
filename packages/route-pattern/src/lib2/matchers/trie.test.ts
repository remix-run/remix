import { describe, expect, it } from 'vitest'

import { parse } from '../route-pattern/parse.ts'
import type * as RoutePattern from '../route-pattern/index.ts'
import { Trie } from './trie.ts'

function searchAll(trie: Trie<RoutePattern.AST>, url: URL) {
  return [...trie.search(url)]
}

describe('trie', () => {
  describe('constructor', () => {
    it('creates a trie with empty nodes', () => {
      let trie = new Trie()
      expect(trie.static).toEqual({})
      expect(trie.variable).toEqual(new Map())
      expect(trie.wildcard).toEqual(new Map())
      expect(trie.next).toBe(undefined)
      expect(trie.match).toBe(undefined)
    })
  })

  describe('insert', () => {
    it('inserts a simple static pathname pattern', () => {
      let trie = new Trie()
      let pattern = parse('users/list')
      trie.insert(pattern, null)

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (pathname)
      expect(trie.next?.next?.static['users']).toBeTruthy()
      expect(trie.next?.next?.static['users']?.static['list']).toBeTruthy()
    })

    it('inserts a pattern with dynamic segment', () => {
      let trie = new Trie()
      let pattern = parse('users/:id')
      trie.insert(pattern, null)

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (pathname)
      expect(trie.next?.next?.static['users']).toBeTruthy()
      expect(trie.next?.next?.static['users']?.variable.has('{:}')).toBeTruthy()
    })

    it('inserts a full URL pattern', () => {
      let trie = new Trie()
      let pattern = parse('https://example.com/users/:id')
      trie.insert(pattern, null)

      // Protocol level
      expect(trie.static['https']).toBeTruthy()
      // Should have a next pointer to move to hostname level
      expect(trie.static['https']?.next).toBeTruthy()
      // Hostname level (reversed: com, example)
      let hostnameLevel = trie.static['https']?.next
      expect(hostnameLevel?.static['com']).toBeTruthy()
      expect(hostnameLevel?.static['com']?.static['example']).toBeTruthy()
      // Should have a next pointer to move to pathname level
      expect(hostnameLevel?.static['com']?.static['example']?.next).toBeTruthy()
    })

    it('inserts patterns with optional segments', () => {
      let trie = new Trie()
      let pattern = parse('api/(v:major(.:minor)/)run')
      trie.insert(pattern, null)

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (pathname)
      let pathnameLevel = trie.next?.next

      // Should have multiple variants added to the trie
      // Variant 1: api/run
      expect(pathnameLevel?.static['api']).toBeTruthy()
      expect(pathnameLevel?.static['api']?.static['run']).toBeTruthy()

      // Variant 2: api/v{:}/run
      expect(pathnameLevel?.static['api']?.variable.get('v{:}')).toBeTruthy()

      // Variant 3: api/v{:}.{:}/run
      expect(pathnameLevel?.static['api']?.variable.get('v{:}.{:}')).toBeTruthy()
    })

    it('inserts multiple patterns with shared prefixes', () => {
      let trie = new Trie()
      let pattern1 = parse('users/:id')
      let pattern2 = parse('users/admin')
      let pattern3 = parse('posts/:id')

      trie.insert(pattern1, null)
      trie.insert(pattern2, null)
      trie.insert(pattern3, null)

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (pathname)
      let pathnameLevel = trie.next?.next

      // Users branch
      expect(pathnameLevel?.static['users']).toBeTruthy()
      expect(pathnameLevel?.static['users']?.static['admin']).toBeTruthy()
      expect(pathnameLevel?.static['users']?.variable.has('{:}')).toBeTruthy()

      // Posts branch
      expect(pathnameLevel?.static['posts']).toBeTruthy()
      expect(pathnameLevel?.static['posts']?.variable.has('{:}')).toBeTruthy()
    })

    it('inserts a pattern with a wildcard', () => {
      let trie = new Trie()
      let pattern = parse('files/*path')
      trie.insert(pattern, null)

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (pathname)
      let pathnameLevel = trie.next?.next

      // Should have static 'files' segment
      expect(pathnameLevel?.static['files']).toBeTruthy()
      // Wildcard should be stored in the wildcard map
      expect(pathnameLevel?.static['files']?.wildcard.has('{*}')).toBeTruthy()
    })

    it('inserts a pattern with wildcard after static prefix', () => {
      let trie = new Trie()
      let pattern = parse('assets/images/*file')
      trie.insert(pattern, null)

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (pathname)
      let pathnameLevel = trie.next?.next

      expect(pathnameLevel?.static['assets']).toBeTruthy()
      expect(pathnameLevel?.static['assets']?.static['images']).toBeTruthy()
      expect(pathnameLevel?.static['assets']?.static['images']?.wildcard.has('{*}')).toBeTruthy()
    })

    it('inserts a pattern with inline wildcard', () => {
      let trie = new Trie()
      let pattern = parse('files/prefix-*rest')
      trie.insert(pattern, null)

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (pathname)
      let pathnameLevel = trie.next?.next

      expect(pathnameLevel?.static['files']).toBeTruthy()
      // Wildcard key should include the prefix
      expect(pathnameLevel?.static['files']?.wildcard.has('prefix-{*}')).toBeTruthy()
    })

    it('inserts a pattern with anonymous wildcard', () => {
      let trie = new Trie()
      let pattern = parse('api/*')
      trie.insert(pattern, null)

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (pathname)
      let pathnameLevel = trie.next?.next

      expect(pathnameLevel?.static['api']).toBeTruthy()
      expect(pathnameLevel?.static['api']?.wildcard.has('{*}')).toBeTruthy()
    })

    it('inserts a pattern with wildcard followed by static segment', () => {
      let trie = new Trie()
      let pattern = parse('files/*path/details')
      trie.insert(pattern, null)

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (pathname)
      let pathnameLevel = trie.next?.next

      expect(pathnameLevel?.static['files']).toBeTruthy()
      // Wildcard key should include the segments after the wildcard
      expect(pathnameLevel?.static['files']?.wildcard.has('{*}/details')).toBeTruthy()
    })

    it('inserts a pattern with wildcard followed by multiple segments', () => {
      let trie = new Trie()
      let pattern = parse('files/*path/foo/bar')
      trie.insert(pattern, null)

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (pathname)
      let pathnameLevel = trie.next?.next

      expect(pathnameLevel?.static['files']).toBeTruthy()
      // Wildcard key should include all segments after the wildcard
      expect(pathnameLevel?.static['files']?.wildcard.has('{*}/foo/bar')).toBeTruthy()
    })

    it('inserts a pattern with wildcard followed by dynamic segment', () => {
      let trie = new Trie()
      let pattern = parse('files/*path/:id')
      trie.insert(pattern, null)

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (pathname)
      let pathnameLevel = trie.next?.next

      expect(pathnameLevel?.static['files']).toBeTruthy()
      // Wildcard key should include the dynamic segment after the wildcard
      expect(pathnameLevel?.static['files']?.wildcard.has('{*}/{:}')).toBeTruthy()
    })
  })

  describe('search', () => {
    it('matches a simple static pathname pattern', () => {
      let trie = new Trie<RoutePattern.AST>()
      let pattern = parse('users/list')
      trie.insert(pattern, pattern)

      let matches = searchAll(trie, new URL('https://example.com/users/list'))
      expect(matches.length).toBe(1)
      expect(matches[0]?.data).toBe(pattern)
      expect(matches[0]?.params).toEqual({})
    })

    it('returns no matches for non-matching URL', () => {
      let trie = new Trie<RoutePattern.AST>()
      let pattern = parse('users/list')
      trie.insert(pattern, pattern)

      let matches = searchAll(trie, new URL('https://example.com/posts/list'))
      expect(matches.length).toBe(0)
    })

    it('matches a pattern with dynamic segment', () => {
      let trie = new Trie<RoutePattern.AST>()
      let pattern = parse('users/:id')
      trie.insert(pattern, pattern)

      let matches = searchAll(trie, new URL('https://example.com/users/123'))
      expect(matches.length).toBe(1)
      expect(matches[0]?.data).toBe(pattern)
      expect(matches[0]?.params).toEqual({ id: '123' })
    })

    it('matches a full URL pattern', () => {
      let trie = new Trie<RoutePattern.AST>()
      let pattern = parse('https://example.com/users/:id')
      trie.insert(pattern, pattern)

      let matches = searchAll(trie, new URL('https://example.com/users/456'))
      expect(matches.length).toBe(1)
      expect(matches[0]?.data).toBe(pattern)
      expect(matches[0]?.params).toEqual({ id: '456' })
    })

    it('does not match wrong protocol', () => {
      let trie = new Trie<RoutePattern.AST>()
      let pattern = parse('https://example.com/users')
      trie.insert(pattern, pattern)

      let matches = searchAll(trie, new URL('http://example.com/users'))
      expect(matches.length).toBe(0)
    })

    it('does not match wrong hostname', () => {
      let trie = new Trie<RoutePattern.AST>()
      let pattern = parse('https://example.com/users')
      trie.insert(pattern, pattern)

      let matches = searchAll(trie, new URL('https://other.com/users'))
      expect(matches.length).toBe(0)
    })

    it('matches a pattern with wildcard', () => {
      let trie = new Trie<RoutePattern.AST>()
      let pattern = parse('files/*path')
      trie.insert(pattern, pattern)

      let matches = searchAll(trie, new URL('https://example.com/files/a/b/c'))
      expect(matches.length).toBe(1)
      expect(matches[0]?.data).toBe(pattern)
      expect(matches[0]?.params).toEqual({ path: 'a/b/c' })
    })

    it('matches multiple patterns with shared prefix', () => {
      let trie = new Trie<RoutePattern.AST>()
      let pattern1 = parse('users/:id')
      let pattern2 = parse('users/admin')
      trie.insert(pattern1, pattern1)
      trie.insert(pattern2, pattern2)

      // Should match the static pattern
      let matches1 = searchAll(trie, new URL('https://example.com/users/admin'))
      expect(matches1.length).toBe(2) // Both patterns match
      // Static match has no params
      expect(matches1.find((m) => m.data === pattern2)?.params).toEqual({})
      // Dynamic match captures 'admin' as the id
      expect(matches1.find((m) => m.data === pattern1)?.params).toEqual({ id: 'admin' })

      // Should only match the dynamic pattern
      let matches2 = searchAll(trie, new URL('https://example.com/users/123'))
      expect(matches2.length).toBe(1)
      expect(matches2[0]?.data).toBe(pattern1)
      expect(matches2[0]?.params).toEqual({ id: '123' })
    })

    it('matches a pattern with optional variable when optional is not matched', () => {
      let trie = new Trie<RoutePattern.AST>()
      let pattern = parse('api/v:major(.:minor)')
      trie.insert(pattern, pattern)

      // Match without the optional minor version - minor should be explicitly undefined
      let matches = searchAll(trie, new URL('https://example.com/api/v2'))
      expect(matches.length).toBe(1)
      expect(matches[0]?.data).toBe(pattern)
      expect(matches[0]?.params).toStrictEqual({ major: '2', minor: undefined })

      // Match with the optional minor version
      let matches2 = searchAll(trie, new URL('https://example.com/api/v2.1'))
      expect(matches2.length).toBe(2)
      expect(matches2[0]?.data).toBe(pattern)
      expect(matches2[0]?.params).toStrictEqual({ major: '2', minor: '1' })
    })

    it('matches a pattern with optional segment when optional is not matched', () => {
      let trie = new Trie<RoutePattern.AST>()
      let pattern = parse('users/:id(/details)')
      trie.insert(pattern, pattern)

      // Match without the optional segment
      let matches = searchAll(trie, new URL('https://example.com/users/123'))
      expect(matches.length).toBe(1)
      expect(matches[0]?.data).toBe(pattern)
      expect(matches[0]?.params).toEqual({ id: '123' })

      // Match with the optional segment
      let matches2 = searchAll(trie, new URL('https://example.com/users/123/details'))
      expect(matches2.length).toBe(1)
      expect(matches2[0]?.data).toBe(pattern)
      expect(matches2[0]?.params).toEqual({ id: '123' })
    })

    it('ranks static matches higher than dynamic matches', () => {
      let trie = new Trie<RoutePattern.AST>()
      let staticPattern = parse('users/@admin')
      let dynamicPattern = parse('users/@:id')
      trie.insert(staticPattern, staticPattern)
      trie.insert(dynamicPattern, dynamicPattern)

      let matches = searchAll(trie, new URL('https://example.com/users/@admin'))
      expect(matches.length).toBe(2)

      // Static match should have rank of all 0s for pathname segments
      // Dynamic match should have rank of 1s where the variable matched
      let staticMatch = matches.find((m) => m.data === staticPattern)
      let dynamicMatch = matches.find((m) => m.data === dynamicPattern)

      // The rank array covers: protocol (5 chars "https") + hostname (3 "com" + 7 "example") + pathname (5 "users" + 5 "admin")
      // Total: 5 + 3 + 7 + 5 + 5 = 25

      expect(staticMatch).toStrictEqual({
        // prettier-ignore
        rank: new Uint8Array([
          3, 3, 3, 3, 3,                // protocol "https" - skipped (3)
          3, 3, 3, 3, 3, 3, 3, 3, 3, 3, // hostname "com" + "example" - skipped (3)
          0, 0, 0, 0, 0,                // pathname "users" - static (0)
          0, 0, 0, 0, 0, 0,             // pathname "@admin" - static (0)
        ]),
        params: {},
        data: staticPattern,
      })

      expect(dynamicMatch).toStrictEqual({
        // prettier-ignore
        rank: new Uint8Array([
          3, 3, 3, 3, 3,                // protocol "https" - skipped (3)
          3, 3, 3, 3, 3, 3, 3, 3, 3, 3, // hostname "com" + "example" - skipped (3)
          0, 0, 0, 0, 0,                // pathname "users" - static (0)
          0, 1, 1, 1, 1, 1,             // pathname "@admin" matched by @:id - variable (1)
        ]),
        params: { id: 'admin' },
        data: dynamicPattern,
      })
    })
  })
})
