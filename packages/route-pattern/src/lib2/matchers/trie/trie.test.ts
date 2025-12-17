import { describe, expect, it } from 'vitest'

import { parse } from '../../route-pattern/parse.ts'
import type * as RoutePattern from '../../route-pattern/index.ts'
import { Trie } from './trie.ts'

function searchAll(trie: Trie<RoutePattern.AST>, url: URL) {
  return [...trie.search(url)]
}

describe('Trie', () => {
  describe('constructor', () => {
    it('creates a trie with empty nodes', () => {
      let trie = new Trie()
      expect(trie.static).toEqual({})
      expect(trie.variable).toEqual(new Map())
      expect(trie.wildcard).toEqual(new Map())
      expect(trie.next).toBe(undefined)
      expect(trie.value).toBe(undefined)
    })
  })

  describe('insert', () => {
    it('inserts a simple static pathname pattern', () => {
      let trie = new Trie()
      let pattern = parse('users/list')
      trie.insert(pattern, null)

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (port) -> next (pathname)
      expect(trie.next?.next?.next?.static['users']).toBeTruthy()
      expect(trie.next?.next?.next?.static['users']?.static['list']).toBeTruthy()
    })

    it('inserts a pattern with dynamic segment', () => {
      let trie = new Trie()
      let pattern = parse('users/:id')
      trie.insert(pattern, null)

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (port) -> next (pathname)
      expect(trie.next?.next?.next?.static['users']).toBeTruthy()
      expect(trie.next?.next?.next?.static['users']?.variable.has('{:}')).toBeTruthy()
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

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (port) -> next (pathname)
      let pathnameLevel = trie.next?.next?.next

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

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (port) -> next (pathname)
      let pathnameLevel = trie.next?.next?.next

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

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (port) -> next (pathname)
      let pathnameLevel = trie.next?.next?.next

      // Should have static 'files' segment
      expect(pathnameLevel?.static['files']).toBeTruthy()
      // Wildcard should be stored in the wildcard map
      expect(pathnameLevel?.static['files']?.wildcard.has('{*}')).toBeTruthy()
    })

    it('inserts a pattern with wildcard after static prefix', () => {
      let trie = new Trie()
      let pattern = parse('assets/images/*file')
      trie.insert(pattern, null)

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (port) -> next (pathname)
      let pathnameLevel = trie.next?.next?.next

      expect(pathnameLevel?.static['assets']).toBeTruthy()
      expect(pathnameLevel?.static['assets']?.static['images']).toBeTruthy()
      expect(pathnameLevel?.static['assets']?.static['images']?.wildcard.has('{*}')).toBeTruthy()
    })

    it('inserts a pattern with inline wildcard', () => {
      let trie = new Trie()
      let pattern = parse('files/prefix-*rest')
      trie.insert(pattern, null)

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (port) -> next (pathname)
      let pathnameLevel = trie.next?.next?.next

      expect(pathnameLevel?.static['files']).toBeTruthy()
      // Wildcard key should include the prefix
      expect(pathnameLevel?.static['files']?.wildcard.has('prefix-{*}')).toBeTruthy()
    })

    it('inserts a pattern with anonymous wildcard', () => {
      let trie = new Trie()
      let pattern = parse('api/*')
      trie.insert(pattern, null)

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (port) -> next (pathname)
      let pathnameLevel = trie.next?.next?.next

      expect(pathnameLevel?.static['api']).toBeTruthy()
      expect(pathnameLevel?.static['api']?.wildcard.has('{*}')).toBeTruthy()
    })

    it('inserts a pattern with wildcard followed by static segment', () => {
      let trie = new Trie()
      let pattern = parse('files/*path/details')
      trie.insert(pattern, null)

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (port) -> next (pathname)
      let pathnameLevel = trie.next?.next?.next

      expect(pathnameLevel?.static['files']).toBeTruthy()
      // Wildcard key should include the segments after the wildcard
      expect(pathnameLevel?.static['files']?.wildcard.has('{*}/details')).toBeTruthy()
    })

    it('inserts a pattern with wildcard followed by multiple segments', () => {
      let trie = new Trie()
      let pattern = parse('files/*path/foo/bar')
      trie.insert(pattern, null)

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (port) -> next (pathname)
      let pathnameLevel = trie.next?.next?.next

      expect(pathnameLevel?.static['files']).toBeTruthy()
      // Wildcard key should include all segments after the wildcard
      expect(pathnameLevel?.static['files']?.wildcard.has('{*}/foo/bar')).toBeTruthy()
    })

    it('inserts a pattern with wildcard followed by dynamic segment', () => {
      let trie = new Trie()
      let pattern = parse('files/*path/:id')
      trie.insert(pattern, null)

      // Navigate to pathname level: root (protocol) -> next (hostname) -> next (port) -> next (pathname)
      let pathnameLevel = trie.next?.next?.next

      expect(pathnameLevel?.static['files']).toBeTruthy()
      // Wildcard key should include the dynamic segment after the wildcard
      expect(pathnameLevel?.static['files']?.wildcard.has('{*}/{:}')).toBeTruthy()
    })

    it('stores value with paramNames and paramIndices', () => {
      let trie = new Trie()
      let pattern = parse('users/:id')
      let data = { route: 'user-detail' }
      trie.insert(pattern, data)

      // Navigate to the leaf node: protocol -> hostname -> port -> pathname (users) -> variable ({:}) -> port -> search
      let pathnameLevel = trie.next?.next?.next
      let usersLevel = pathnameLevel?.static['users']
      let variableLevel = usersLevel?.variable.get('{:}')?.trie
      // After variable, we need to traverse to the end
      let leaf = variableLevel?.next
      expect(leaf?.value).toBeTruthy()
      expect(leaf?.value?.data).toBe(data)
      expect(leaf?.value?.paramNames).toEqual(['id'])
    })

    it('stores correct paramNames for multiple params', () => {
      let trie = new Trie()
      let pattern = parse('org/:orgId/repo/:repoId')
      let data = { route: 'repo-detail' }
      trie.insert(pattern, data)

      // Navigate through the trie to find the leaf
      let pathnameLevel = trie.next?.next?.next
      let orgLevel = pathnameLevel?.static['org']
      let orgIdLevel = orgLevel?.variable.get('{:}')?.trie
      let repoLevel = orgIdLevel?.static['repo']
      let repoIdLevel = repoLevel?.variable.get('{:}')?.trie
      let leaf = repoIdLevel?.next

      expect(leaf?.value).toBeTruthy()
      expect(leaf?.value?.paramNames).toEqual(['orgId', 'repoId'])
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

      let staticMatch = matches.find((m) => m.data === staticPattern)
      let dynamicMatch = matches.find((m) => m.data === dynamicPattern)

      expect(staticMatch).toStrictEqual({
        rank: [
          '3', // protocol: "https" (skipped: 3)
          '3', // hostname: "com" (skipped: 3)
          '3', // hostname: "example" (skipped: 3)
          '3', // port: "" (skipped: 3)
          '0', // pathname: "users" (static: 0)
          '0', // pathname: "@admin" (static: 0)
        ],
        params: {},
        data: staticPattern,
      })

      expect(dynamicMatch).toStrictEqual({
        rank: [
          '3', // protocol: "https" (skipped: 3)
          '3', // hostname: "com" (skipped: 3)
          '3', // hostname: "example" (skipped: 3)
          '3', // port: "" (skipped: 3)
          '0', // pathname: "users" (static: 0)
          '011111', // pathname: "@admin" (dynamic: "011111")
        ],
        params: { id: 'admin' },
        data: dynamicPattern,
      })
    })

    it('matches pattern with static prefix + wildcard in segment', () => {
      let trie = new Trie<RoutePattern.AST>()
      let pattern = parse('files/image-*rest')
      trie.insert(pattern, pattern)

      let matches = searchAll(trie, new URL('https://example.com/files/image-photo/gallery/2024'))
      expect(matches.length).toBe(1)
      expect(matches[0]).toStrictEqual({
        rank: [
          '3', // protocol: "https" (skipped: 3)
          '3', // hostname: "com" (skipped: 3)
          '3', // hostname: "example" (skipped: 3)
          '3', // port: "" (skipped: 3)
          '0', // pathname: "files" (static: 0)
          '00000022222', // pathname: "image-" (static) + "photo" (wildcard)
          '2222222', // pathname: "gallery" (wildcard)
          '2222', // pathname: "2024" (wildcard)
        ],
        params: { rest: 'photo/gallery/2024' },
        data: pattern,
      })
    })

    it('matches pattern with variable + static suffix in segment', () => {
      let trie = new Trie<RoutePattern.AST>()
      let pattern = parse('assets/:name.png')
      trie.insert(pattern, pattern)

      let matches = searchAll(trie, new URL('https://example.com/assets/logo.png'))
      expect(matches.length).toBe(1)
      expect(matches[0]).toStrictEqual({
        rank: [
          '3', // protocol: "https" (skipped: 3)
          '3', // hostname: "com" (skipped: 3)
          '3', // hostname: "example" (skipped: 3)
          '3', // port: "" (skipped: 3)
          '0', // pathname: "assets" (static: 0)
          '11110000', // pathname: "logo" (variable) + ".png" (static)
        ],
        params: { name: 'logo' },
        data: pattern,
      })
    })

    it('matches pattern with static + variable + static in same segment', () => {
      let trie = new Trie<RoutePattern.AST>()
      let pattern = parse('api/v:version-beta')
      trie.insert(pattern, pattern)

      let matches = searchAll(trie, new URL('https://example.com/api/v2-beta'))
      expect(matches.length).toBe(1)
      expect(matches[0]).toStrictEqual({
        rank: [
          '3', // protocol: "https" (skipped: 3)
          '3', // hostname: "com" (skipped: 3)
          '3', // hostname: "example" (skipped: 3)
          '3', // port: "" (skipped: 3)
          '0', // pathname: "api" (static: 0)
          '0100000', // pathname: "v" (static) + "2" (variable) + "-beta" (static)
        ],
        params: { version: '2' },
        data: pattern,
      })
    })

    it('matches pattern with static + wildcard + static across segments', () => {
      let trie = new Trie<RoutePattern.AST>()
      let pattern = parse('docs/*path/edit')
      trie.insert(pattern, pattern)

      let matches = searchAll(trie, new URL('https://example.com/docs/guides/intro/edit'))
      expect(matches.length).toBe(1)
      expect(matches[0]).toStrictEqual({
        rank: [
          '3', // protocol: "https" (skipped: 3)
          '3', // hostname: "com" (skipped: 3)
          '3', // hostname: "example" (skipped: 3)
          '3', // port: "" (skipped: 3)
          '0', // pathname: "docs" (static: 0)
          '222222', // pathname: "guides" (wildcard)
          '22222', // pathname: "intro" (wildcard)
          '0000', // pathname: "edit" (static)
        ],
        params: { path: 'guides/intro' },
        data: pattern,
      })
    })

    it('matches pattern with variable, wildcard, and static in later segments', () => {
      let trie = new Trie<RoutePattern.AST>()
      let pattern = parse('org/:orgId/*path/settings')
      trie.insert(pattern, pattern)

      let matches = searchAll(trie, new URL('https://example.com/org/acme/projects/web/settings'))
      expect(matches.length).toBe(1)
      expect(matches[0]).toStrictEqual({
        rank: [
          '3', // protocol: "https" (skipped: 3)
          '3', // hostname: "com" (skipped: 3)
          '3', // hostname: "example" (skipped: 3)
          '3', // port: "" (skipped: 3)
          '0', // pathname: "org" (static: 0)
          '1111', // pathname: "acme" (variable)
          '22222222', // pathname: "projects" (wildcard)
          '222', // pathname: "web" (wildcard)
          '00000000', // pathname: "settings" (static)
        ],
        params: { orgId: 'acme', path: 'projects/web' },
        data: pattern,
      })
    })

    it('ranks patterns with more static content higher', () => {
      let trie = new Trie<RoutePattern.AST>()
      let moreStatic = parse('files/images-*rest')
      let lessStatic = parse('files/*rest')
      trie.insert(moreStatic, moreStatic)
      trie.insert(lessStatic, lessStatic)

      let matches = searchAll(trie, new URL('https://example.com/files/images-photo.jpg'))
      expect(matches.length).toBe(2)

      let moreStaticMatch = matches.find((m) => m.data === moreStatic)
      let lessStaticMatch = matches.find((m) => m.data === lessStatic)

      // More static should have lower rank (better) - string comparison works lexicographically
      expect(moreStaticMatch!.rank.join(',') < lessStaticMatch!.rank.join(',')).toBe(true)

      expect(moreStaticMatch).toStrictEqual({
        rank: [
          '3', // protocol: "https" (skipped: 3)
          '3', // hostname: "com" (skipped: 3)
          '3', // hostname: "example" (skipped: 3)
          '3', // port: "" (skipped: 3)
          '0', // pathname: "files" (static: 0)
          '0000000222222222', // pathname: "images-" (static) + "photo.jpg" (wildcard)
        ],
        params: { rest: 'photo.jpg' },
        data: moreStatic,
      })

      expect(lessStaticMatch).toStrictEqual({
        rank: [
          '3', // protocol: "https" (skipped: 3)
          '3', // hostname: "com" (skipped: 3)
          '3', // hostname: "example" (skipped: 3)
          '3', // port: "" (skipped: 3)
          '0', // pathname: "files" (static: 0)
          '2222222222222222', // pathname: "images-photo.jpg" (all wildcard)
        ],
        params: { rest: 'images-photo.jpg' },
        data: lessStatic,
      })
    })

    it('matches complex pattern with multiple dynamic segments and wildcards', () => {
      let trie = new Trie<RoutePattern.AST>()
      let pattern = parse('api/:version/users/:userId/*action')
      trie.insert(pattern, pattern)

      let matches = searchAll(trie, new URL('https://example.com/api/v2/users/123/posts/create'))
      expect(matches.length).toBe(1)
      expect(matches[0]).toStrictEqual({
        rank: [
          '3', // protocol: "https" (skipped: 3)
          '3', // hostname: "com" (skipped: 3)
          '3', // hostname: "example" (skipped: 3)
          '3', // port: "" (skipped: 3)
          '0', // pathname: "api" (static: 0)
          '11', // pathname: "v2" (variable)
          '0', // pathname: "users" (static: 0)
          '111', // pathname: "123" (variable)
          '22222', // pathname: "posts" (wildcard)
          '222222', // pathname: "create" (wildcard)
        ],
        params: { version: 'v2', userId: '123', action: 'posts/create' },
        data: pattern,
      })
    })
  })
})
