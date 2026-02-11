import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Matcher } from './matcher.ts'
import * as Specificity from './specificity.ts'
import { ArrayMatcher } from './array-matcher.ts'
import { TrieMatcher } from './trie-matcher.ts'

type MatcherConstructor = new (options?: { ignoreCase?: boolean }) => Matcher<null>

describe('ArrayMatcher', () => testSuite(ArrayMatcher))
describe('TrieMatcher', () => testSuite(TrieMatcher))

function testSuite(MatcherClass: MatcherConstructor): void {
  describe('match', () => {
    describe('protocol', () => {
      it('matches any protocol when protocol is omitted', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/users', null)

        let httpMatch = matcher.match('http://example.com/users')
        assert.ok(httpMatch)

        let httpsMatch = matcher.match('https://example.com/users')
        assert.ok(httpsMatch)
      })

      it('matches http only when protocol is explicit http', () => {
        let matcher = new MatcherClass()
        matcher.add('http://example.com/users', null)

        let match = matcher.match('http://example.com/users')
        assert.ok(match)
      })

      it('matches https only when protocol is explicit https', () => {
        let matcher = new MatcherClass()
        matcher.add('https://example.com/users', null)

        let match = matcher.match('https://example.com/users')
        assert.ok(match)
      })

      it('matches both http and https when protocol is http(s)', () => {
        let matcher = new MatcherClass()
        matcher.add('http(s)://example.com/users', null)

        let httpMatch = matcher.match('http://example.com/users')
        assert.ok(httpMatch)

        let httpsMatch = matcher.match('https://example.com/users')
        assert.ok(httpsMatch)
      })

      it('returns null when protocol does not match', () => {
        let matcher = new MatcherClass()
        matcher.add('http://example.com/users', null)

        let match = matcher.match('https://example.com/users')
        assert.equal(match, null)
      })
    })

    describe('hostname', () => {
      it('matches any hostname when hostname is omitted', () => {
        let matcher = new MatcherClass()
        matcher.add('users', null)

        let match1 = matcher.match('https://example.com/users')
        assert.ok(match1)

        let match2 = matcher.match('https://other.com/users')
        assert.ok(match2)

        let match3 = matcher.match('http://localhost/users')
        assert.ok(match3)
      })

      it('matches exact static hostname', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/users', null)

        let match = matcher.match('https://example.com/users')
        assert.ok(match)
        assert.deepEqual(match.params, {})
      })

      it('returns null when static hostname does not match', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/users', null)

        let match = matcher.match('https://other.com/users')
        assert.equal(match, null)
      })

      it('matches variable segment in hostname', () => {
        let matcher = new MatcherClass()
        matcher.add('://:subdomain.example.com/api', null)

        let match = matcher.match('https://api.example.com/api')
        assert.ok(match)
        assert.deepEqual(match.params, { subdomain: 'api' })
      })

      it('matches multiple variables in hostname', () => {
        let matcher = new MatcherClass()
        matcher.add('://:subdomain.:env.example.com/api', null)

        let match = matcher.match('https://api.prod.example.com/api')
        assert.ok(match)
        assert.deepEqual(match.params, { subdomain: 'api', env: 'prod' })
      })

      it('matches wildcard segment in hostname', () => {
        let matcher = new MatcherClass()
        matcher.add('://*host.example.com/api', null)

        let match = matcher.match('https://api.v1.example.com/api')
        assert.ok(match)
        assert.deepEqual(match.params, { host: 'api.v1' })
      })

      it('excludes unnamed wildcard from params', () => {
        let matcher = new MatcherClass()
        matcher.add('://*.example.com/api', null)

        let match = matcher.match('https://api.v1.example.com/api')
        assert.ok(match)
        assert.deepEqual(match.params, {})
      })

      it('matches optional hostname segments when present', () => {
        let matcher = new MatcherClass()
        matcher.add('://api(-:version).example.com/users', null)

        let match = matcher.match('https://api-v2.example.com/users')
        assert.ok(match)
        assert.deepEqual(match.params, { version: 'v2' })
      })

      it('matches optional hostname segments when absent', () => {
        let matcher = new MatcherClass()
        matcher.add('://api(-:version).example.com/users', null)

        let match = matcher.match('https://api.example.com/users')
        assert.ok(match)
        assert.deepEqual(match.params, { version: undefined })
      })

      it('matches nested optionals in hostname', () => {
        let matcher = new MatcherClass()
        matcher.add('://api(.:region(-:zone)).example.com/users', null)

        let matchAll = matcher.match('https://api.us-east1.example.com/users')
        assert.ok(matchAll)
        assert.deepEqual(matchAll.params, { region: 'us', zone: 'east1' })

        let matchPartial = matcher.match('https://api.us.example.com/users')
        assert.ok(matchPartial)
        assert.deepEqual(matchPartial.params, { region: 'us', zone: undefined })

        let matchNone = matcher.match('https://api.example.com/users')
        assert.ok(matchNone)
        assert.deepEqual(matchNone.params, { region: undefined, zone: undefined })
      })

      it('matches multiple optionals in hostname', () => {
        let matcher = new MatcherClass()
        matcher.add('://:sub(-:version).example(.:tld).com/api', null)

        let match = matcher.match('https://api-v2.example.dev.com/api')
        assert.ok(match)
        assert.deepEqual(match.params, { sub: 'api', version: 'v2', tld: 'dev' })
      })

      it('matches mixed static/variable/wildcard segments', () => {
        let matcher = new MatcherClass()
        matcher.add('://*prefix.:env.example.com/api', null)

        let match = matcher.match('https://api.v1.prod.example.com/api')
        assert.ok(match)
        assert.deepEqual(match.params, { prefix: 'api.v1', env: 'prod' })
      })

      it('prefers static over variable hostname', () => {
        let matcher = new MatcherClass()
        matcher.add('://:subdomain.example.com/api', null)
        matcher.add('://api.example.com/api', null)

        let match = matcher.match('https://api.example.com/api')
        assert.ok(match)
        assert.equal(match.pattern.source, '://api.example.com/api')
      })

      it('prefers variable over wildcard hostname', () => {
        let matcher = new MatcherClass()
        matcher.add('://*host.example.com/api', null)
        matcher.add('://:subdomain.example.com/api', null)

        let match = matcher.match('https://api.example.com/api')
        assert.ok(match)
        assert.equal(match.pattern.source, '://:subdomain.example.com/api')
      })

      it('prefers longer static prefix in hostname', () => {
        let matcher = new MatcherClass()
        matcher.add('://:subdomain.com/api', null)
        matcher.add('://:subdomain.example.com/api', null)

        let match = matcher.match('https://api.example.com/api')
        assert.ok(match)
        assert.equal(match.pattern.source, '://:subdomain.example.com/api')
      })
    })

    describe('port', () => {
      it('matches omitted port in URL when port is omitted in pattern', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/users', null)

        assert.ok(matcher.match('http://example.com/users'))
        assert.ok(matcher.match('https://example.com/users'))
      })

      it('matches explicit port', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com:8080/users', null)

        let match = matcher.match('http://example.com:8080/users')
        assert.ok(match)
        assert.deepEqual(match.params, {})
      })

      it('returns null when explicit port does not match', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com:8080/users', null)

        assert.equal(matcher.match('http://example.com:3000/users'), null)
      })

      it('returns null when pattern has explicit port but URL omits port', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com:8080/users', null)

        assert.equal(matcher.match('http://example.com/users'), null)
      })

      it('returns null when pattern omits port but URL has explicit port', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/users', null)

        assert.equal(matcher.match('http://example.com:8080/users'), null)
      })

      it('matches port with hostname variables', () => {
        let matcher = new MatcherClass()
        matcher.add('://:subdomain.example.com:8080/api', null)

        let match = matcher.match('https://api.example.com:8080/api')
        assert.ok(match)
        assert.deepEqual(match.params, { subdomain: 'api' })
      })
    })

    describe('pathname', () => {
      it('matches root pathname when pathname is empty', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com', null)

        assert.ok(matcher.match('http://example.com/'))
      })

      it('matches static segments', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/users/list', null)

        let match = matcher.match('http://example.com/users/list')
        assert.ok(match)
        assert.deepEqual(match.params, {})
      })

      it('returns null when static segment does not match', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/users', null)

        assert.equal(matcher.match('http://example.com/posts'), null)
      })

      it('returns null when URL is shorter than pattern', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/users/list', null)

        assert.equal(matcher.match('http://example.com/users'), null)
      })

      it('returns null when trailing slash does not match', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/users', null)

        assert.equal(matcher.match('http://example.com/users/'), null)
      })

      it('matches variable segments', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/users/:id', null)

        let match = matcher.match('http://example.com/users/123')
        assert.ok(match)
        assert.deepEqual(match.params, { id: '123' })
      })

      it('matches multiple variables', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/users/:userId/posts/:postId', null)

        let match = matcher.match('http://example.com/users/42/posts/99')
        assert.ok(match)
        assert.deepEqual(match.params, { userId: '42', postId: '99' })
      })

      it('matches special characters in variable values', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/files/:filename', null)

        let match = matcher.match('http://example.com/files/my-file_v2.txt')
        assert.ok(match)
        assert.deepEqual(match.params, { filename: 'my-file_v2.txt' })
      })

      it('preserves URL encoding in variable values', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/search/:query', null)

        let match = matcher.match('http://example.com/search/hello%20world')
        assert.ok(match)
        assert.deepEqual(match.params, { query: 'hello%20world' })
      })

      it('matches wildcard segments', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/files/*path', null)

        let match = matcher.match('http://example.com/files/docs/readme.md')
        assert.ok(match)
        assert.deepEqual(match.params, { path: 'docs/readme.md' })
      })

      it('matches wildcard with continuation', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/files/*path/status', null)

        let match = matcher.match('http://example.com/files/docs/api/status')
        assert.ok(match)
        assert.deepEqual(match.params, { path: 'docs/api' })
      })

      it('excludes unnamed wildcard from params', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/files/*/download', null)

        let match = matcher.match('http://example.com/files/docs/download')
        assert.ok(match)
        assert.deepEqual(match.params, {})
      })

      it('matches optional segments when present', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/posts(/:lang)', null)

        let match = matcher.match('http://example.com/posts/en')
        assert.ok(match)
        assert.deepEqual(match.params, { lang: 'en' })
      })

      it('matches optional segments when absent', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/posts(/:lang)', null)

        let match = matcher.match('http://example.com/posts')
        assert.ok(match)
        assert.deepEqual(match.params, { lang: undefined })
      })

      it('matches nested optionals', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/docs(/:version(/:page))', null)

        let match1 = matcher.match('http://example.com/docs/v1/intro')
        assert.ok(match1)
        assert.deepEqual(match1.params, { version: 'v1', page: 'intro' })

        let match2 = matcher.match('http://example.com/docs/v1')
        assert.ok(match2)
        assert.deepEqual(match2.params, { version: 'v1', page: undefined })

        let match3 = matcher.match('http://example.com/docs')
        assert.ok(match3)
        assert.deepEqual(match3.params, { version: undefined, page: undefined })
      })

      it('matches multiple optionals', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/api(/:version)/users(/:id)', null)

        let match = matcher.match('http://example.com/api/v2/users/123')
        assert.ok(match)
        assert.deepEqual(match.params, { version: 'v2', id: '123' })
      })

      it('matches complex optionals for file extensions', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/files/:id(.:format)', null)

        let match1 = matcher.match('http://example.com/files/doc123.pdf')
        assert.ok(match1)
        assert.deepEqual(match1.params, { id: 'doc123', format: 'pdf' })

        let match2 = matcher.match('http://example.com/files/doc123')
        assert.ok(match2)
        assert.deepEqual(match2.params, { id: 'doc123', format: undefined })
      })

      it('matches mixed static/variable/wildcard segments', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/api/:version/files/*path', null)

        let match = matcher.match('http://example.com/api/v1/files/docs/guide.pdf')
        assert.ok(match)
        assert.deepEqual(match.params, { version: 'v1', path: 'docs/guide.pdf' })
      })

      it('matches deep nesting', () => {
        let matcher = new MatcherClass()
        matcher.add(
          '://example.com/products/electronics/computers/laptops/gaming/accessories/keyboards',
          null,
        )

        let match = matcher.match(
          'http://example.com/products/electronics/computers/laptops/gaming/accessories/keyboards',
        )
        assert.ok(match)
        assert.deepEqual(match.params, {})
      })

      it('prefers static over variable pathname', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/users/new', null)
        matcher.add('://example.com/users/:id', null)

        let match = matcher.match('http://example.com/users/new')
        assert.ok(match)
        assert.equal(match.pattern.source, '://example.com/users/new')
      })

      it('prefers variable over wildcard pathname', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/files/*path', null)
        matcher.add('://example.com/files/:id', null)

        let match = matcher.match('http://example.com/files/123')
        assert.ok(match)
        assert.equal(match.pattern.source, '://example.com/files/:id')
      })

      it('prefers longer static prefix in pathname', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/api/:id', null)
        matcher.add('://example.com/api/v1/:id', null)

        let match = matcher.match('http://example.com/api/v1/users')
        assert.ok(match)
        assert.equal(match.pattern.source, '://example.com/api/v1/:id')
      })
    })

    describe('search', () => {
      it('matches any query params when no search constraints', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/search', null)

        assert.ok(matcher.match('http://example.com/search'))
        assert.ok(matcher.match('http://example.com/search?q=test'))
        assert.ok(matcher.match('http://example.com/search?q=test&lang=en'))
      })

      it('matches bare parameter for presence check', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/search?q', null)

        let match = matcher.match('http://example.com/search?q')
        assert.ok(match)
      })

      it('matches bare parameter with any value', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/search?q', null)

        assert.ok(matcher.match('http://example.com/search?q=test'))
        assert.ok(matcher.match('http://example.com/search?q=hello'))
      })

      it('matches any value constraint with non-empty value', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/search?q=', null)

        let match = matcher.match('http://example.com/search?q=test')
        assert.ok(match)
      })

      it('returns null when any value constraint has empty value', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/search?q=', null)

        assert.equal(matcher.match('http://example.com/search?q='), null)
        assert.equal(matcher.match('http://example.com/search?q'), null)
      })

      it('matches specific value with exact match', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/api?format=json', null)

        let match = matcher.match('http://example.com/api?format=json')
        assert.ok(match)
      })

      it('returns null when specific value does not match', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/api?format=json', null)

        assert.equal(matcher.match('http://example.com/api?format=xml'), null)
      })

      it('matches multiple constraints', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/search?q=&lang=en', null)

        let match = matcher.match('http://example.com/search?q=test&lang=en')
        assert.ok(match)
      })

      it('matches constraints regardless of order', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/api?format=json&version=v1', null)

        let match = matcher.match('http://example.com/api?version=v1&format=json')
        assert.ok(match)
      })

      it('allows extra params beyond constraints', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/search?q', null)

        let match = matcher.match('http://example.com/search?q=test&lang=en&page=2')
        assert.ok(match)
      })

      it('preserves URL encoding in search parameter values', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/search?q=hello%20world', null)

        let match = matcher.match('http://example.com/search?q=hello%20world')
        assert.ok(match)
      })

      it('matches repeated parameter values', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/filter?tags', null)

        let match = matcher.match('http://example.com/filter?tags=a&tags=b')
        assert.ok(match)
      })

      it('returns null when constraint is not met', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/api?auth', null)

        assert.equal(matcher.match('http://example.com/api'), null)
        assert.equal(matcher.match('http://example.com/api?other=value'), null)
      })

      it('prefers more constraints over fewer', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/search?q', null)
        matcher.add('://example.com/search?q&lang', null)

        let match = matcher.match('http://example.com/search?q=test&lang=en')
        assert.ok(match)
        assert.equal(match.pattern.source, '://example.com/search?q&lang')
      })

      it('prefers exact value over any value', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/api?format', null)
        matcher.add('://example.com/api?format=json', null)

        let match = matcher.match('http://example.com/api?format=json')
        assert.ok(match)
        assert.equal(match.pattern.source, '://example.com/api?format=json')
      })

      it('prefers any value over bare presence', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/search?q', null)
        matcher.add('://example.com/search?q=', null)

        let match = matcher.match('http://example.com/search?q=test')
        assert.ok(match)
        assert.equal(match.pattern.source, '://example.com/search?q=')
      })
    })

    describe('ignoreCase', () => {
      it('uses case-sensitive pathname matching by default', () => {
        let matcher = new MatcherClass()
        matcher.add('/Posts/:id', null)

        assert.equal(matcher.match('https://example.com/posts/123'), null)
        assert.equal(matcher.match('https://example.com/POSTS/123'), null)
        assert.ok(matcher.match('https://example.com/Posts/123'))
      })

      it('ignores pathname case when ignoreCase is true', () => {
        let matcher = new MatcherClass({ ignoreCase: true })
        matcher.add('/Posts/:id', null)

        assert.ok(matcher.match('https://example.com/posts/123'))
        assert.ok(matcher.match('https://example.com/POSTS/123'))
        assert.ok(matcher.match('https://example.com/Posts/123'))
      })

      it('ignores hostname case regardless of ignoreCase', () => {
        let matcher = new MatcherClass()
        matcher.add('://Example.COM/users', null)

        assert.ok(matcher.match('https://example.com/users'))
        assert.ok(matcher.match('https://EXAMPLE.COM/users'))
      })

      it('matches search params case-sensitively regardless of ignoreCase', () => {
        let matcher = new MatcherClass({ ignoreCase: true })
        matcher.add('/api?Sort', null)

        assert.ok(matcher.match('https://example.com/api?Sort'))
        assert.equal(matcher.match('https://example.com/api?sort'), null)
      })

      it('defaults to false', () => {
        let matcher = new MatcherClass()
        matcher.add('/Posts/:id', null)
        assert.equal(matcher.match('https://example.com/posts/123'), null)
      })
    })

    describe('paramsMeta', () => {
      it('returns empty arrays when no params', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/users', null)

        let match = matcher.match('http://example.com/users')
        assert.ok(match)
        assert.deepEqual(match.paramsMeta.hostname, [])
        assert.deepEqual(match.paramsMeta.pathname, [])
      })

      it('includes wildcard hostname metadata for pathname-only patterns', () => {
        let matcher = new MatcherClass()
        matcher.add('/users/:id', null)

        let match = matcher.match('http://example.com/users/123')
        assert.ok(match)
        assert.deepEqual(match.paramsMeta.hostname, [
          { type: '*', name: '*', begin: 0, end: 11, value: 'example.com' },
        ])
        assert.deepEqual(match.paramsMeta.pathname, [
          { type: ':', name: 'id', begin: 6, end: 9, value: '123' },
        ])
      })

      it('includes hostname params with metadata', () => {
        let matcher = new MatcherClass()
        matcher.add('://:subdomain.example.com/api', null)

        let match = matcher.match('https://api.example.com/api')
        assert.ok(match)
        assert.equal(match.paramsMeta.hostname.length, 1)
        assert.equal(match.paramsMeta.hostname[0].name, 'subdomain')
        assert.equal(match.paramsMeta.hostname[0].type, ':')
        assert.equal(match.paramsMeta.hostname[0].value, 'api')
        assert.deepEqual(match.paramsMeta.pathname, [])
      })

      it('includes pathname params with metadata', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/users/:id', null)

        let match = matcher.match('http://example.com/users/123')
        assert.ok(match)
        assert.deepEqual(match.paramsMeta.hostname, [])
        assert.equal(match.paramsMeta.pathname.length, 1)
        assert.equal(match.paramsMeta.pathname[0].name, 'id')
        assert.equal(match.paramsMeta.pathname[0].type, ':')
        assert.equal(match.paramsMeta.pathname[0].value, '123')
      })

      it('includes params from both hostname and pathname', () => {
        let matcher = new MatcherClass()
        matcher.add('://:subdomain.example.com/users/:id', null)

        let match = matcher.match('https://api.example.com/users/123')
        assert.ok(match)
        assert.equal(match.paramsMeta.hostname.length, 1)
        assert.equal(match.paramsMeta.hostname[0].name, 'subdomain')
        assert.equal(match.paramsMeta.hostname[0].value, 'api')
        assert.equal(match.paramsMeta.pathname.length, 1)
        assert.equal(match.paramsMeta.pathname[0].name, 'id')
        assert.equal(match.paramsMeta.pathname[0].value, '123')
      })

      it('includes wildcard params in metadata', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/files/*path', null)

        let match = matcher.match('http://example.com/files/docs/readme.md')
        assert.ok(match)
        assert.equal(match.paramsMeta.pathname.length, 1)
        assert.equal(match.paramsMeta.pathname[0].name, 'path')
        assert.equal(match.paramsMeta.pathname[0].type, '*')
        assert.equal(match.paramsMeta.pathname[0].value, 'docs/readme.md')
      })

      it('includes unnamed wildcards in metadata with name "*"', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/files/*/download', null)

        let match = matcher.match('http://example.com/files/docs/download')
        assert.ok(match)
        assert.equal(match.paramsMeta.pathname.length, 1)
        assert.equal(match.paramsMeta.pathname[0].name, '*')
        assert.equal(match.paramsMeta.pathname[0].type, '*')
        assert.equal(match.paramsMeta.pathname[0].value, 'docs')
      })

      it('excludes undefined optional params from metadata', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/posts(/:lang)', null)

        let match = matcher.match('http://example.com/posts')
        assert.ok(match)
        assert.deepEqual(match.paramsMeta.pathname, [])
      })

      it('includes only matched optional params in metadata', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/docs(/:version(/:page))', null)

        let match = matcher.match('http://example.com/docs/v1')
        assert.ok(match)
        assert.equal(match.paramsMeta.pathname.length, 1)
        assert.equal(match.paramsMeta.pathname[0].name, 'version')
        assert.equal(match.paramsMeta.pathname[0].value, 'v1')
      })
    })

    describe('specificity', () => {
      it('prefers static over variable', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/:segment', null)
        matcher.add('://example.com/users', null)

        let match = matcher.match('http://example.com/users')
        assert.ok(match)
        assert.equal(match.pattern.source, '://example.com/users')
      })

      it('prefers variable over wildcard', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/*path', null)
        matcher.add('://example.com/:id', null)

        let match = matcher.match('http://example.com/123')
        assert.ok(match)
        assert.equal(match.pattern.source, '://example.com/:id')
      })

      it('prefers longer static prefix over shorter', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/:id', null)
        matcher.add('://example.com/api/:id', null)

        let match = matcher.match('http://example.com/api/users')
        assert.ok(match)
        assert.equal(match.pattern.source, '://example.com/api/:id')
      })

      it('prefers hostname specificity over pathname specificity', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/*path', null)
        matcher.add('://:subdomain.example.com/users', null)

        let match = matcher.match('http://api.example.com/users')
        assert.ok(match)
        assert.equal(match.pattern.source, '://:subdomain.example.com/users')
      })

      it('increases specificity with search constraints', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/search', null)
        matcher.add('://example.com/search?q', null)

        let match = matcher.match('http://example.com/search?q=test')
        assert.ok(match)
        assert.equal(match.pattern.source, '://example.com/search?q')
      })

      it('returns null when no patterns match', () => {
        let matcher = new MatcherClass()
        matcher.add('://example.com/users', null)
        matcher.add('://example.com/posts', null)

        assert.equal(matcher.match('http://example.com/comments'), null)
      })
    })
  })

  describe('matchAll', () => {
    it('returns all matches sorted by specificity', () => {
      let matcher = new MatcherClass()
      matcher.add('://example.com/*path', null)
      matcher.add('://example.com/users/:id', null)
      matcher.add('://example.com/users/new', null)

      let matches = matcher.matchAll('http://example.com/users/new')
      assert.deepEqual(
        matches.map((m) => m.pattern.source),
        ['://example.com/users/new', '://example.com/users/:id', '://example.com/*path'],
      )
    })

    it('returns empty array when no matches', () => {
      let matcher = new MatcherClass()
      matcher.add('://example.com/users', null)
      matcher.add('://example.com/posts', null)

      let matches = matcher.matchAll('http://example.com/comments')
      assert.deepEqual(matches, [])
    })

    it('includes patterns with same specificity', () => {
      let matcher = new MatcherClass()
      matcher.add('://example.com/users/:id', null)
      matcher.add('://example.com/posts/:id', null)

      let matches = matcher.matchAll('http://example.com/users/123')
      assert.deepEqual(
        matches.map((m) => m.pattern.source),
        ['://example.com/users/:id'],
      )

      let matches2 = matcher.matchAll('http://example.com/posts/456')
      assert.deepEqual(
        matches2.map((m) => m.pattern.source),
        ['://example.com/posts/:id'],
      )
    })

    it('orders complex specificity scenarios consistently', () => {
      let matcher = new MatcherClass()
      // Add patterns in random order to ensure ordering is by specificity, not insertion order
      matcher.add('/*path', null)
      matcher.add('://api.example.com/users/:id', null)
      matcher.add('://:subdomain.example.com/*path', null)
      matcher.add('://api.example.com/*path', null)
      matcher.add('/users/:id', null)
      matcher.add('://api.example.com/users/123', null)
      matcher.add('://:subdomain.example.com/users/:id', null)
      matcher.add('://api.example.com/:resource/:id', null)
      matcher.add('://api.example.com/users(/:id)', null)
      matcher.add('/users(/:id)', null)
      matcher.add('://api(.:region).example.com/users/:id', null)

      let matches = matcher.matchAll('http://api.example.com/users/123')

      assert.deepEqual(
        matches.map((m) => m.pattern.source),
        [
          '://api.example.com/users/123',
          '://api.example.com/users/:id',
          '://api.example.com/users(/:id)',
          '://api(.:region).example.com/users/:id',
          '://api.example.com/:resource/:id',
          '://api.example.com/*path',
          '://:subdomain.example.com/users/:id',
          '://:subdomain.example.com/*path',
          '/users/:id',
          '/users(/:id)',
          '/*path',
        ],
      )
    })
  })

  describe('custom compareFn', () => {
    it('uses custom compareFn for match() to select best', () => {
      let matcher = new MatcherClass()
      matcher.add('://example.com/*path', null)
      matcher.add('://example.com/users/:id', null)
      matcher.add('://example.com/users/123', null)

      // Default behavior: static wins
      let defaultMatch = matcher.match('http://example.com/users/123')
      assert.ok(defaultMatch)
      assert.equal(defaultMatch.pattern.source, '://example.com/users/123')

      // Custom: prefer least specific (reverse of default)
      let customMatch = matcher.match('http://example.com/users/123', Specificity.ascending)
      assert.ok(customMatch)
      assert.equal(customMatch.pattern.source, '://example.com/*path')
    })

    it('uses custom compareFn for matchAll() to sort results', () => {
      let matcher = new MatcherClass()
      matcher.add('://example.com/*path', null)
      matcher.add('://example.com/users/:id', null)
      matcher.add('://example.com/users/123', null)

      // Custom: sort by pattern source alphabetically
      let matches = matcher.matchAll('http://example.com/users/123', (a, b) =>
        a.pattern.source.localeCompare(b.pattern.source),
      )

      assert.deepEqual(
        matches.map((m) => m.pattern.source),
        ['://example.com/*path', '://example.com/users/:id', '://example.com/users/123'],
      )
    })

    it('supports ascending specificity order', () => {
      let matcher = new MatcherClass()
      matcher.add('://example.com/*path', null)
      matcher.add('://example.com/users/:id', null)
      matcher.add('://example.com/users/123', null)

      let matches = matcher.matchAll('http://example.com/users/123', Specificity.ascending)

      assert.deepEqual(
        matches.map((m) => m.pattern.source),
        ['://example.com/*path', '://example.com/users/:id', '://example.com/users/123'],
      )
    })
  })
}
