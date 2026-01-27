import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { RoutePattern } from './route-pattern.ts'
import * as Specificity from './specificity.ts'

describe('specificity', () => {
  describe('compare', () => {
    function assertCompare(patterns: [string, string], url: URL | string, expected: -1 | 0 | 1) {
      url = typeof url === 'string' ? new URL(url) : url
      let a = new RoutePattern(patterns[0])
      let b = new RoutePattern(patterns[1])
      let matchA = a.match(url)
      let matchB = b.match(url)

      assert.notEqual(matchA, null, `Pattern A "${patterns[0]}" should match URL "${url}"`)
      assert.notEqual(matchB, null, `Pattern B "${patterns[1]}" should match URL "${url}"`)

      assert.equal(Specificity.compare(matchA!, matchB!), expected)
    }

    describe('hostname', () => {
      it('ranks static higher than variable', () => {
        assertCompare(['https://example.com', 'https://:subdomain.com'], 'https://example.com', 1)
      })

      it('ranks variable higher than wildcard', () => {
        assertCompare(['https://:subdomain.com', 'https://*.com'], 'https://example.com', 1)
      })

      it('ties when variables have same range', () => {
        assertCompare(['https://:subdomain.com', 'https://:other.com'], 'https://example.com', 0)
      })

      it('ties when wildcards have same range', () => {
        assertCompare(['https://*.com', 'https://*.com'], 'https://example.com', 0)
      })

      it('ranks variable with prefix/suffix higher than bare variable', () => {
        assertCompare(['https://e:sub.com', 'https://:subdomain.com'], 'https://example.com', 1)
      })

      it('ranks wildcard with prefix/suffix higher than bare wildcard', () => {
        assertCompare(['https://e*.com', 'https://*.com'], 'https://example.com', 1)
      })

      it('breaks tie on variables and wildcards by subsequent characters', () => {
        assertCompare(
          ['https://a*.cd.:ef.*.com', 'https://*.cd.:ef.*.com'],
          'https://ab.cd.ef.gh.com',
          1,
        )
      })

      it('ranks segments right-to-left but chars within segments left-to-right', () => {
        assertCompare(['https://a.*b-c.d', 'https://a.b-*c.d'], 'https://a.b-xxx.yyy-c.d', 1)
      })

      it('ranks back-to-back variables with static content higher', () => {
        assertCompare(['https://:a-:b.com', 'https://:sub.com'], 'https://ab-cd.com', 1)
      })

      it('ranks back-to-back wildcards with static content higher', () => {
        assertCompare(['https://*-*.com', 'https://*.com'], 'https://ab-cd.com', 1)
      })
    })

    describe('pathname', () => {
      it('ranks static higher than variable', () => {
        assertCompare(
          ['https://example.com/posts/123', 'https://example.com/posts/:id'],
          'https://example.com/posts/123',
          1,
        )
      })

      it('ranks variable higher than wildcard', () => {
        assertCompare(
          ['https://example.com/posts/:id', 'https://example.com/posts/*'],
          'https://example.com/posts/123',
          1,
        )
      })

      it('ties when variables have same range', () => {
        assertCompare(
          ['https://example.com/posts/:id', 'https://example.com/posts/:other'],
          'https://example.com/posts/123',
          0,
        )
      })

      it('ties when wildcards have same range', () => {
        assertCompare(
          ['https://example.com/posts/*', 'https://example.com/posts/*'],
          'https://example.com/posts/123',
          0,
        )
      })

      it('ranks variable with prefix/suffix higher than bare variable', () => {
        assertCompare(
          ['https://example.com/posts-:id', 'https://example.com/:segment'],
          'https://example.com/posts-123',
          1,
        )
      })

      it('ranks wildcard with prefix/suffix higher than bare wildcard', () => {
        assertCompare(
          ['https://example.com/p*', 'https://example.com/*/:id'],
          'https://example.com/posts/123',
          1,
        )
      })

      it('breaks tie on variables and wildcards by subsequent characters', () => {
        assertCompare(
          ['https://example.com/*/123/:id/7*', 'https://example.com/*/123/:id/*'],
          'https://example.com/posts/123/456/789',
          1,
        )
      })

      it('ranks back-to-back variables with static content higher', () => {
        assertCompare(
          ['https://example.com/:a/:b', 'https://example.com/*'],
          'https://example.com/posts/123',
          1,
        )
      })

      it('ranks back-to-back wildcards with static content higher', () => {
        assertCompare(
          ['https://example.com/*/*', 'https://example.com/*'],
          'https://example.com/posts/123',
          1,
        )
      })
    })

    describe('search', () => {
      it('ranks exact value higher than any value', () => {
        assertCompare(
          ['https://example.com/posts?q=hello', 'https://example.com/posts?q'],
          'https://example.com/posts?q=hello',
          1,
        )
      })

      it('ranks any value higher than key only', () => {
        assertCompare(
          ['https://example.com/posts?q=', 'https://example.com/posts?q'],
          'https://example.com/posts?q=hello',
          1,
        )
      })

      it('ranks more constraints higher', () => {
        assertCompare(
          ['https://example.com/posts?q=&a=', 'https://example.com/posts?q='],
          'https://example.com/posts?q=hello&a=1',
          1,
        )
      })

      it('ties on different keys with same count', () => {
        assertCompare(
          ['https://example.com/posts?q=', 'https://example.com/posts?a='],
          'https://example.com/posts?q=hello&a=1',
          0,
        )
      })

      it('ranks multiple exact values higher than single any value', () => {
        assertCompare(
          ['https://example.com/posts?q=hello&q=world', 'https://example.com/posts?q'],
          'https://example.com/posts?q=hello&q=world',
          1,
        )
      })

      it('ranks exact values higher than any values', () => {
        assertCompare(
          ['https://example.com/posts?q=hello&a=1', 'https://example.com/posts?q&a'],
          'https://example.com/posts?q=hello&a=1&b=2',
          1,
        )
      })
    })

    it('throws when comparing matches for different URLs', () => {
      let pattern = new RoutePattern('https://example.com/:path')
      let match1 = pattern.match('https://example.com/foo')
      let match2 = pattern.match('https://example.com/bar')

      assert.notEqual(match1, null)
      assert.notEqual(match2, null)

      assert.throws(
        () => Specificity.compare(match1!, match2!),
        /Cannot compare matches for different URLs/,
      )
    })
  })
})
