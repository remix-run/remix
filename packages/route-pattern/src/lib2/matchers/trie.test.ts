import { describe, expect, it } from 'vitest'

import { parse } from '../route-pattern/parse.ts'
import type * as RoutePattern from '../route-pattern/index.ts'
import { create, insert, search, type Match } from './trie.ts'

function createMatch(pattern: RoutePattern.AST): Match {
  return {
    pattern,
    paramIndices: [[], [], []],
  }
}

function searchAll(trie: ReturnType<typeof create>, url: URL): Match[] {
  return [...search(trie, url)]
}

describe('trie', () => {
  describe('create', () => {
    it('creates a trie with empty nodes', () => {
      let trie = create()
      expect(trie.static).toEqual({})
      expect(trie.variable).toEqual(new Map())
      expect(trie.wildcard).toEqual(new Map())
      expect(trie.next).toBe(undefined)
      expect(trie.match).toBe(undefined)
    })
  })

  describe('insert', () => {
    it('inserts a simple static pathname pattern', () => {
      let trie = create()
      let pattern = parse('users/list')
      insert(trie, createMatch(pattern))

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (pathname)
      expect(trie.next?.next?.static['users']).toBeTruthy()
      expect(trie.next?.next?.static['users']?.static['list']).toBeTruthy()
    })

    it('inserts a pattern with dynamic segment', () => {
      let trie = create()
      let pattern = parse('users/:id')
      insert(trie, createMatch(pattern))

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (pathname)
      expect(trie.next?.next?.static['users']).toBeTruthy()
      expect(trie.next?.next?.static['users']?.variable.has('{:}')).toBeTruthy()
    })

    it('inserts a full URL pattern', () => {
      let trie = create()
      let pattern = parse('https://example.com/users/:id')
      insert(trie, createMatch(pattern))

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
      let trie = create()
      let pattern = parse('api/(v:major(.:minor)/)run')
      insert(trie, createMatch(pattern))

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
      let trie = create()
      let pattern1 = parse('users/:id')
      let pattern2 = parse('users/admin')
      let pattern3 = parse('posts/:id')

      insert(trie, createMatch(pattern1))
      insert(trie, createMatch(pattern2))
      insert(trie, createMatch(pattern3))

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
      let trie = create()
      let pattern = parse('files/*path')
      insert(trie, createMatch(pattern))

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (pathname)
      let pathnameLevel = trie.next?.next

      // Should have static 'files' segment
      expect(pathnameLevel?.static['files']).toBeTruthy()
      // Wildcard should be stored in the wildcard map
      expect(pathnameLevel?.static['files']?.wildcard.has('{*}')).toBeTruthy()
    })

    it('inserts a pattern with wildcard after static prefix', () => {
      let trie = create()
      let pattern = parse('assets/images/*file')
      insert(trie, createMatch(pattern))

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (pathname)
      let pathnameLevel = trie.next?.next

      expect(pathnameLevel?.static['assets']).toBeTruthy()
      expect(pathnameLevel?.static['assets']?.static['images']).toBeTruthy()
      expect(pathnameLevel?.static['assets']?.static['images']?.wildcard.has('{*}')).toBeTruthy()
    })

    it('inserts a pattern with inline wildcard', () => {
      let trie = create()
      let pattern = parse('files/prefix-*rest')
      insert(trie, createMatch(pattern))

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (pathname)
      let pathnameLevel = trie.next?.next

      expect(pathnameLevel?.static['files']).toBeTruthy()
      // Wildcard key should include the prefix
      expect(pathnameLevel?.static['files']?.wildcard.has('prefix-{*}')).toBeTruthy()
    })

    it('inserts a pattern with anonymous wildcard', () => {
      let trie = create()
      let pattern = parse('api/*')
      insert(trie, createMatch(pattern))

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (pathname)
      let pathnameLevel = trie.next?.next

      expect(pathnameLevel?.static['api']).toBeTruthy()
      expect(pathnameLevel?.static['api']?.wildcard.has('{*}')).toBeTruthy()
    })

    it('inserts a pattern with wildcard followed by static segment', () => {
      let trie = create()
      let pattern = parse('files/*path/details')
      insert(trie, createMatch(pattern))

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (pathname)
      let pathnameLevel = trie.next?.next

      expect(pathnameLevel?.static['files']).toBeTruthy()
      // Wildcard key should include the segments after the wildcard
      expect(pathnameLevel?.static['files']?.wildcard.has('{*}/details')).toBeTruthy()
    })

    it('inserts a pattern with wildcard followed by multiple segments', () => {
      let trie = create()
      let pattern = parse('files/*path/foo/bar')
      insert(trie, createMatch(pattern))

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (pathname)
      let pathnameLevel = trie.next?.next

      expect(pathnameLevel?.static['files']).toBeTruthy()
      // Wildcard key should include all segments after the wildcard
      expect(pathnameLevel?.static['files']?.wildcard.has('{*}/foo/bar')).toBeTruthy()
    })

    it('inserts a pattern with wildcard followed by dynamic segment', () => {
      let trie = create()
      let pattern = parse('files/*path/:id')
      insert(trie, createMatch(pattern))

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (pathname)
      let pathnameLevel = trie.next?.next

      expect(pathnameLevel?.static['files']).toBeTruthy()
      // Wildcard key should include the dynamic segment after the wildcard
      expect(pathnameLevel?.static['files']?.wildcard.has('{*}/{:}')).toBeTruthy()
    })
  })

  describe('search', () => {
    it('matches a simple static pathname pattern', () => {
      let trie = create()
      let pattern = parse('users/list')
      insert(trie, createMatch(pattern))

      let matches = searchAll(trie, new URL('https://example.com/users/list'))
      expect(matches.length).toBe(1)
      expect(matches[0]?.pattern).toBe(pattern)
    })

    it('returns no matches for non-matching URL', () => {
      let trie = create()
      let pattern = parse('users/list')
      insert(trie, createMatch(pattern))

      let matches = searchAll(trie, new URL('https://example.com/posts/list'))
      expect(matches.length).toBe(0)
    })

    it('matches a pattern with dynamic segment', () => {
      let trie = create()
      let pattern = parse('users/:id')
      insert(trie, createMatch(pattern))

      let matches = searchAll(trie, new URL('https://example.com/users/123'))
      expect(matches.length).toBe(1)
      expect(matches[0]?.pattern).toBe(pattern)
    })

    it('matches a full URL pattern', () => {
      let trie = create()
      let pattern = parse('https://example.com/users/:id')
      insert(trie, createMatch(pattern))

      let matches = searchAll(trie, new URL('https://example.com/users/456'))
      expect(matches.length).toBe(1)
      expect(matches[0]?.pattern).toBe(pattern)
    })

    it('does not match wrong protocol', () => {
      let trie = create()
      let pattern = parse('https://example.com/users')
      insert(trie, createMatch(pattern))

      let matches = searchAll(trie, new URL('http://example.com/users'))
      expect(matches.length).toBe(0)
    })

    it('does not match wrong hostname', () => {
      let trie = create()
      let pattern = parse('https://example.com/users')
      insert(trie, createMatch(pattern))

      let matches = searchAll(trie, new URL('https://other.com/users'))
      expect(matches.length).toBe(0)
    })

    it('matches a pattern with wildcard', () => {
      let trie = create()
      let pattern = parse('files/*path')
      insert(trie, createMatch(pattern))

      let matches = searchAll(trie, new URL('https://example.com/files/a/b/c'))
      expect(matches.length).toBe(1)
      expect(matches[0]?.pattern).toBe(pattern)
    })

    it('matches multiple patterns with shared prefix', () => {
      let trie = create()
      let pattern1 = parse('users/:id')
      let pattern2 = parse('users/admin')
      insert(trie, createMatch(pattern1))
      insert(trie, createMatch(pattern2))

      // Should match the static pattern
      let matches1 = searchAll(trie, new URL('https://example.com/users/admin'))
      expect(matches1.length).toBe(2) // Both patterns match

      // Should only match the dynamic pattern
      let matches2 = searchAll(trie, new URL('https://example.com/users/123'))
      expect(matches2.length).toBe(1)
      expect(matches2[0]?.pattern).toBe(pattern1)
    })
  })
})
