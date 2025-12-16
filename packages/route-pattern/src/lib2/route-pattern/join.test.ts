import { describe, expect, it } from 'vitest'

import { join } from './join.ts'
import { parse } from './parse.ts'

describe('join', () => {
  describe('protocol', () => {
    it('uses b.protocol when defined', () => {
      let a = parse('http://example.com/path')
      let b = parse('https://other.com/')
      let result = join(a, b)
      expect(result.protocol).toEqual({
        tokens: [{ type: 'text', text: 'https' }],
        paramNames: [],
        optionals: new Map(),
      })
    })

    it('falls back to a.protocol when b.protocol is undefined', () => {
      let a = parse('https://example.com/path')
      let b = parse('/other')
      let result = join(a, b)
      expect(result.protocol).toEqual({
        tokens: [{ type: 'text', text: 'https' }],
        paramNames: [],
        optionals: new Map(),
      })
    })

    it('is undefined when both are undefined', () => {
      let a = parse('/path')
      let b = parse('/other')
      let result = join(a, b)
      expect(result.protocol).toBeUndefined()
    })
  })

  describe('hostname', () => {
    it('uses b.hostname when defined', () => {
      let a = parse('https://example.com/path')
      let b = parse('https://other.com/')
      let result = join(a, b)
      expect(result.hostname).toEqual({
        tokens: [{ type: 'text', text: 'other.com' }],
        paramNames: [],
        optionals: new Map(),
      })
    })

    it('falls back to a.hostname when b.hostname is undefined', () => {
      let a = parse('https://example.com/path')
      let b = parse('/other')
      let result = join(a, b)
      expect(result.hostname).toEqual({
        tokens: [{ type: 'text', text: 'example.com' }],
        paramNames: [],
        optionals: new Map(),
      })
    })
  })

  describe('port', () => {
    it('uses b.port when defined', () => {
      let a = parse('https://example.com:8080/path')
      let b = parse('https://other.com:3000/')
      let result = join(a, b)
      expect(result.port).toBe('3000')
    })

    it('falls back to a.port when b.port is undefined', () => {
      let a = parse('https://example.com:8080/path')
      let b = parse('/other')
      let result = join(a, b)
      expect(result.port).toBe('8080')
    })
  })

  describe('pathname', () => {
    it('joins two pathnames with slash when neither has one', () => {
      let a = parse('users')
      let b = parse(':id')
      let result = join(a, b)
      expect(result.pathname).toEqual({
        tokens: [
          { type: 'text', text: 'users' },
          { type: 'text', text: '/' },
          { type: ':', nameIndex: 0 },
        ],
        paramNames: ['id'],
        optionals: new Map(),
      })
    })

    it('does not add slash when a ends with slash', () => {
      let a = parse('users/')
      let b = parse(':id')
      let result = join(a, b)
      expect(result.pathname).toEqual({
        tokens: [
          { type: 'text', text: 'users/' },
          { type: ':', nameIndex: 0 },
        ],
        paramNames: ['id'],
        optionals: new Map(),
      })
    })

    it('does not add slash when b begins with slash', () => {
      let a = parse('users')
      let b = parse('/:id')
      let result = join(a, b)
      expect(result.pathname).toEqual({
        tokens: [
          { type: 'text', text: 'users' },
          { type: 'text', text: '/' },
          { type: ':', nameIndex: 0 },
        ],
        paramNames: ['id'],
        optionals: new Map(),
      })
    })

    it('does not add slash when both have slashes', () => {
      let a = parse('users/')
      let b = parse('/:id')
      let result = join(a, b)
      expect(result.pathname).toEqual({
        tokens: [
          { type: 'text', text: 'users/' },
          { type: ':', nameIndex: 0 },
        ],
        paramNames: ['id'],
        optionals: new Map(),
      })
    })

    it('returns b when a.pathname is undefined', () => {
      let a = parse('https://example.com')
      a.pathname = undefined
      let b = parse('users')
      let result = join(a, b)
      expect(result.pathname).toEqual({
        tokens: [{ type: 'text', text: 'users' }],
        paramNames: [],
        optionals: new Map(),
      })
    })

    it('returns a when b.pathname is undefined', () => {
      let a = parse('users')
      let b = parse('https://example.com')
      b.pathname = undefined
      let result = join(a, b)
      expect(result.pathname).toEqual({
        tokens: [{ type: 'text', text: 'users' }],
        paramNames: [],
        optionals: new Map(),
      })
    })

    it('returns undefined when both pathnames are undefined', () => {
      let a = parse('https://example.com')
      a.pathname = undefined
      let b = parse('https://other.com')
      b.pathname = undefined
      let result = join(a, b)
      expect(result.pathname).toBeUndefined()
    })
  })

  describe('params merging', () => {
    it('merges paramNames from both pathnames', () => {
      let a = parse(':org/:repo')
      let b = parse('issues/:id')
      let result = join(a, b)
      expect(result.pathname?.paramNames).toEqual(['org', 'repo', 'id'])
    })

    it('updates nameIndex for b tokens', () => {
      let a = parse(':org/:repo')
      let b = parse(':branch/:file')
      let result = join(a, b)
      expect(result.pathname?.tokens).toEqual([
        { type: ':', nameIndex: 0 },
        { type: 'text', text: '/' },
        { type: ':', nameIndex: 1 },
        { type: 'text', text: '/' },
        { type: ':', nameIndex: 2 },
        { type: 'text', text: '/' },
        { type: ':', nameIndex: 3 },
      ])
      expect(result.pathname?.paramNames).toEqual(['org', 'repo', 'branch', 'file'])
    })
  })

  describe('optionals merging', () => {
    it('preserves optionals from a', () => {
      let a = parse('users(/:id)')
      let b = parse('edit')
      let result = join(a, b)
      expect(result.pathname?.optionals).toEqual(new Map([[1, 4]]))
    })

    it('offsets optionals from b', () => {
      let a = parse('users')
      let b = parse('(/:id)/edit')
      let result = join(a, b)
      expect(result.pathname?.optionals).toEqual(new Map([[1, 4]]))
    })

    it('merges optionals from both with correct offsets', () => {
      let a = parse('users(/:id)')
      let b = parse('(/:action)/confirm')
      let result = join(a, b)
      expect(result.pathname?.optionals).toEqual(
        new Map([
          [1, 4],
          [5, 8],
        ]),
      )
    })

    it('does not add offset for slash when a ends with slash', () => {
      let a = parse('users/')
      let b = parse('(/:id)/edit')
      let result = join(a, b)
      // a has 1 token, no slash added = offset 1
      // b's optionals were at (0, 3), should be at (1, 4)
      expect(result.pathname?.optionals).toEqual(new Map([[1, 4]]))
    })
  })

  describe('search', () => {
    it('uses b.search', () => {
      let a = parse('/path?a=1')
      let b = parse('/other?b=2')
      let result = join(a, b)
      expect(result.search).toBe('b=2')
    })
  })

  describe('integration', () => {
    it('joins base URL with relative path', () => {
      let base = parse('https://api.example.com:8080/v1')
      let path = parse('users/:id/posts')
      let result = join(base, path)

      expect(result.protocol).toEqual({
        tokens: [{ type: 'text', text: 'https' }],
        paramNames: [],
        optionals: new Map(),
      })
      expect(result.hostname).toEqual({
        tokens: [{ type: 'text', text: 'api.example.com' }],
        paramNames: [],
        optionals: new Map(),
      })
      expect(result.port).toBe('8080')
      expect(result.pathname?.paramNames).toEqual(['id'])
    })
  })
})
