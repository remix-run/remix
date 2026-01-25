import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { TrieMatcher } from './trie.ts'

describe('TrieMatcher', () => {
  describe('match', () => {
    describe('static patterns', () => {
      it('matches exact static pattern with full URL', () => {
        let matcher = new TrieMatcher<null>()
        matcher.add('://example.com/users', null)

        let match = matcher.match('https://example.com/users')
        assert.ok(match)
        assert.deepEqual(match.params, {})
        assert.equal(match.url.pathname, '/users')
      })

      it('matches nested static patterns with full URL', () => {
        let matcher = new TrieMatcher<null>()
        matcher.add('://example.com/api/v1/users', null)

        let match = matcher.match('https://example.com/api/v1/users')
        assert.ok(match)
        assert.deepEqual(match.params, {})
      })
    })

    describe('variable patterns', () => {
      it('matches variable and tracks correct offsets in meta.pathname', () => {
        let matcher = new TrieMatcher<null>()
        matcher.add('://example.com/users/:id', null)

        let match = matcher.match('https://example.com/users/123')
        assert.ok(match)
        assert.deepEqual(match.params, { id: '123' })
        assert.equal(match.meta.pathname.length, 1)
        assert.deepEqual(match.meta.pathname[0], {
          name: 'id',
          type: ':',
          value: '123',
          begin: 6,
          end: 9,
        })
      })

      it('matches multiple variables with correct offsets', () => {
        let matcher = new TrieMatcher<null>()
        matcher.add('://example.com/api/v:version/users/:id', null)

        let match = matcher.match('https://example.com/api/v2/users/456')
        assert.ok(match)
        assert.deepEqual(match.params, { version: '2', id: '456' })
        assert.equal(match.meta.pathname.length, 2)
        assert.deepEqual(match.meta.pathname[0], {
          name: 'version',
          type: ':',
          value: '2',
          begin: 5,
          end: 6,
        })
        assert.deepEqual(match.meta.pathname[1], {
          name: 'id',
          type: ':',
          value: '456',
          begin: 13,
          end: 16,
        })
      })
    })

    describe('wildcard patterns', () => {
      it('matches wildcard and tracks correct offsets in meta.pathname', () => {
        let matcher = new TrieMatcher<null>()
        matcher.add('://example.com/files/*path', null)

        let match = matcher.match('https://example.com/files/docs/readme.txt')
        assert.ok(match)
        assert.deepEqual(match.params, { path: 'docs/readme.txt' })
        assert.equal(match.meta.pathname.length, 1)
        assert.deepEqual(match.meta.pathname[0], {
          name: 'path',
          type: '*',
          value: 'docs/readme.txt',
          begin: 6,
          end: 21,
        })
      })
    })
  })
})
