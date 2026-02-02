import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Matcher } from './matcher.ts'

type CreateMatcher = () => Matcher<null>

export function testMatcher(name: string, createMatcher: CreateMatcher): void {
  describe(name, () => {
    // Protocol matching
    // - omitted protocol (pathname-only pattern matches any protocol)
    // - explicit http
    // - explicit https
    // - optional protocol http(s)
    // - protocol mismatch returns null

    // Hostname matching
    // - omitted hostname (pathname-only pattern matches any hostname)
    // - static hostname exact match
    // - static hostname mismatch returns null
    // - variable segment (:subdomain.example.com)
    // - multiple variables in hostname
    // - wildcard segment (*host.example.com)
    // - unnamed wildcard (*) excluded from params
    // - optional hostname segments (api(:version).example.com)
    // - nested optionals
    // - multiple optionals
    // - mixed static/variable/wildcard segments
    // - specificity: static > variable > wildcard
    // - specificity: longer static prefix wins

    // Port matching
    // - omitted port in pattern matches omitted port in URL
    // - explicit port match
    // - explicit port mismatch returns null
    // - port with hostname variables

    // Pathname matching
    // - omitted pathname (just "/" or empty)
    // - root pattern ("") matches "/"
    // - static segments
    // - static segment mismatch returns null
    // - partial match (URL shorter than pattern) returns null
    // - trailing slash mismatch returns null
    // - variable segments (:id)
    // - multiple variables
    // - special characters in variable values (dashes, underscores, etc)
    // - URL encoding in variable values preserved
    // - wildcard segments (*path)
    // - wildcard with continuation (*path/status) - pathname-specific
    // - unnamed wildcard (*) excluded from params
    // - optional segments (/:lang)
    // - nested optionals
    // - multiple optionals
    // - complex optionals for file extensions (:id(.:format))
    // - mixed static/variable/wildcard
    // - deep nesting (many segments)
    // - specificity: static > variable > wildcard
    // - specificity: longer static prefix wins

    // Search parameter matching
    // - no search constraints (matches any query params)
    // - bare parameter (?q) - presence check
    // - bare parameter accepts any value (?q matches ?q=foo)
    // - empty value (?q=) - requires non-empty value
    // - specific value (?q=test) - exact match
    // - multiple constraints (?q=test&format=json)
    // - constraint order independence (?a=1&b=2 matches ?b=2&a=1)
    // - extra params allowed beyond constraints
    // - URL encoding in search parameter values
    // - repeated parameter values (?tags=a&tags=b)
    // - constraint not met returns null
    // - specificity: more constraints > fewer constraints
    // - specificity: exact value > any value > bare presence

    // Specificity ordering via match()
    // - returns most specific match when multiple patterns match
    // - static beats variable
    // - variable beats wildcard
    // - longer static prefix beats shorter
    // - hostname specificity beats pathname specificity
    // - search constraints increase specificity
    // - returns null when no patterns match

    // Specificity ordering via matchAll()
    // - returns all matches sorted by specificity (most to least)
    // - returns empty array when no matches
    // - includes patterns with same specificity
    // - order within same specificity depends on implementation

    // Feature combinations
    // - protocol + hostname + pathname
    // - protocol + hostname + pathname + search
    // - hostname variables + pathname variables
    // - hostname variables + port
    // - pathname variables + search constraints
    // - optionals across multiple URL parts

    // Custom compareFn
    // - match() uses custom compareFn to select best
    // - matchAll() uses custom compareFn to sort results
    // - ascending vs descending order

    describe('match', () => {
      describe('protocol', () => {
        it('matches any protocol when protocol is omitted', () => {
          let matcher = createMatcher()
          matcher.add('://example.com/users', null)

          let httpMatch = matcher.match('http://example.com/users')
          assert.ok(httpMatch)

          let httpsMatch = matcher.match('https://example.com/users')
          assert.ok(httpsMatch)
        })

        it('matches http only when protocol is explicit http', () => {
          let matcher = createMatcher()
          matcher.add('http://example.com/users', null)

          let match = matcher.match('http://example.com/users')
          assert.ok(match)
        })

        it('matches https only when protocol is explicit https', () => {
          let matcher = createMatcher()
          matcher.add('https://example.com/users', null)

          let match = matcher.match('https://example.com/users')
          assert.ok(match)
        })

        it('matches both http and https when protocol is http(s)', () => {
          let matcher = createMatcher()
          matcher.add('http(s)://example.com/users', null)

          let httpMatch = matcher.match('http://example.com/users')
          assert.ok(httpMatch)

          let httpsMatch = matcher.match('https://example.com/users')
          assert.ok(httpsMatch)
        })

        it('returns null when protocol does not match', () => {
          let matcher = createMatcher()
          matcher.add('http://example.com/users', null)

          let match = matcher.match('https://example.com/users')
          assert.equal(match, null)
        })
      })

      describe('hostname', () => {
        it('matches any hostname when hostname is omitted', () => {
          let matcher = createMatcher()
          matcher.add('users', null)

          let match1 = matcher.match('https://example.com/users')
          assert.ok(match1)

          let match2 = matcher.match('https://other.com/users')
          assert.ok(match2)

          let match3 = matcher.match('http://localhost/users')
          assert.ok(match3)
        })

        it('matches exact static hostname', () => {
          let matcher = createMatcher()
          matcher.add('://example.com/users', null)

          let match = matcher.match('https://example.com/users')
          assert.ok(match)
          assert.deepEqual(match.params, {})
        })

        it('returns null when static hostname does not match', () => {
          let matcher = createMatcher()
          matcher.add('://example.com/users', null)

          let match = matcher.match('https://other.com/users')
          assert.equal(match, null)
        })

        it('matches variable segment in hostname', () => {
          let matcher = createMatcher()
          matcher.add('://:subdomain.example.com/api', null)

          let match = matcher.match('https://api.example.com/api')
          assert.ok(match)
          assert.deepEqual(match.params, { subdomain: 'api' })
        })

        it('matches multiple variables in hostname', () => {
          let matcher = createMatcher()
          matcher.add('://:subdomain.:env.example.com/api', null)

          let match = matcher.match('https://api.prod.example.com/api')
          assert.ok(match)
          assert.deepEqual(match.params, { subdomain: 'api', env: 'prod' })
        })

        it('matches wildcard segment in hostname', () => {
          let matcher = createMatcher()
          matcher.add('://*host.example.com/api', null)

          let match = matcher.match('https://api.v1.example.com/api')
          assert.ok(match)
          assert.deepEqual(match.params, { host: 'api.v1' })
        })

        it('excludes unnamed wildcard from params', () => {
          let matcher = createMatcher()
          matcher.add('://*.example.com/api', null)

          let match = matcher.match('https://api.v1.example.com/api')
          assert.ok(match)
          assert.deepEqual(match.params, {})
        })

        it('matches optional hostname segments when present', () => {
          let matcher = createMatcher()
          matcher.add('://api(:version).example.com/users', null)

          let match = matcher.match('https://apiv2.example.com/users')
          assert.ok(match)
          assert.deepEqual(match.params, { version: 'v2' })
        })

        it('matches optional hostname segments when absent', () => {
          let matcher = createMatcher()
          matcher.add('://api(:version).example.com/users', null)

          let match = matcher.match('https://api.example.com/users')
          assert.ok(match)
          assert.deepEqual(match.params, { version: undefined })
        })

        it('matches nested optionals in hostname', () => {
          let matcher = createMatcher()
          matcher.add('://api(:v(:num)).example.com/users', null)

          let matchAll = matcher.match('https://apiv2.example.com/users')
          assert.ok(matchAll)
          assert.deepEqual(matchAll.params, { v: 'v', num: '2' })

          let matchPartial = matcher.match('https://apiv.example.com/users')
          assert.ok(matchPartial)
          assert.deepEqual(matchPartial.params, { v: 'v', num: undefined })

          let matchNone = matcher.match('https://api.example.com/users')
          assert.ok(matchNone)
          assert.deepEqual(matchNone.params, { v: undefined, num: undefined })
        })

        it('matches multiple optionals in hostname', () => {
          let matcher = createMatcher()
          matcher.add('://:sub-(:version).example(:tld).com/api', null)

          let match = matcher.match('https://api-v2.exampledev.com/api')
          assert.ok(match)
          assert.deepEqual(match.params, { sub: 'api', version: 'v2', tld: 'dev' })
        })

        it('matches mixed static/variable/wildcard segments', () => {
          let matcher = createMatcher()
          matcher.add('://*prefix.:env.example.com/api', null)

          let match = matcher.match('https://api.v1.prod.example.com/api')
          assert.ok(match)
          assert.deepEqual(match.params, { prefix: 'api.v1', env: 'prod' })
        })

        it('prefers static over variable hostname', () => {
          let matcher = createMatcher()
          matcher.add('://:subdomain.example.com/api', null)
          matcher.add('://api.example.com/api', null)

          let match = matcher.match('https://api.example.com/api')
          assert.ok(match)
          assert.equal(match.pattern.source, '://api.example.com/api')
        })

        it('prefers variable over wildcard hostname', () => {
          let matcher = createMatcher()
          matcher.add('://*host.example.com/api', null)
          matcher.add('://:subdomain.example.com/api', null)

          let match = matcher.match('https://api.example.com/api')
          assert.ok(match)
          assert.equal(match.pattern.source, '://:subdomain.example.com/api')
        })

        it('prefers longer static prefix in hostname', () => {
          let matcher = createMatcher()
          matcher.add('://:subdomain.com/api', null)
          matcher.add('://:subdomain.example.com/api', null)

          let match = matcher.match('https://api.example.com/api')
          assert.ok(match)
          assert.equal(match.pattern.source, '://:subdomain.example.com/api')
        })
      })
    })

    describe('matchAll', () => {
      // TODO: implement matchAll tests
    })
  })
}
