import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { parsePattern } from './parse.ts'
import { serializePattern } from './serialize.ts'
import {
  createPatternMatcher,
  type RoutePatternMatch,
  type RoutePatternMatcherOptions,
} from './matcher.ts'

describe('createPatternMatcher', () => {
  describe('matchAll', () => {
    describe('protocol', () => {
      it('matches both http and https when protocol is omitted', () => {
        let m = build(['://example.com/users'])
        assert.deepEqual(sources(m.matchAll('http://example.com/users')), ['://example.com/users'])
        assert.deepEqual(sources(m.matchAll('https://example.com/users')), ['://example.com/users'])
      })

      it('matches http only when protocol is explicit http', () => {
        let m = build(['http://example.com/users'])
        assert.deepEqual(sources(m.matchAll('http://example.com/users')), [
          'http://example.com/users',
        ])
        assert.deepEqual(m.matchAll('https://example.com/users'), [])
      })

      it('matches both http and https when protocol is http(s)', () => {
        let m = build(['http(s)://example.com/users'])
        assert.equal(m.matchAll('http://example.com/users').length, 1)
        assert.equal(m.matchAll('https://example.com/users').length, 1)
      })

      it('returns empty when protocol does not match', () => {
        let m = build(['http://example.com/users'])
        assert.deepEqual(m.matchAll('https://example.com/users'), [])
      })
    })

    describe('hostname', () => {
      it('matches any hostname when omitted', () => {
        let m = build(['users'])
        assert.equal(m.matchAll('https://example.com/users').length, 1)
        assert.equal(m.matchAll('http://localhost/users').length, 1)
      })

      it('matches static hostname', () => {
        let m = build(['://example.com/users'])
        let [match] = m.matchAll('https://example.com/users')
        assert.ok(match)
        assert.deepEqual(match.params, {})
      })

      it('returns empty when static hostname does not match', () => {
        let m = build(['://example.com/users'])
        assert.deepEqual(m.matchAll('https://other.com/users'), [])
      })

      it('matches variable in hostname', () => {
        let m = build(['://:subdomain.example.com/api'])
        let [match] = m.matchAll('https://api.example.com/api')
        assert.ok(match)
        assert.deepEqual(match.params, { subdomain: 'api' })
      })

      it('matches multiple variables in hostname', () => {
        let m = build(['://:subdomain.:env.example.com/api'])
        let [match] = m.matchAll('https://api.prod.example.com/api')
        assert.ok(match)
        assert.deepEqual(match.params, { subdomain: 'api', env: 'prod' })
      })

      it('matches wildcard in hostname', () => {
        let m = build(['://*host.example.com/api'])
        let [match] = m.matchAll('https://api.v1.example.com/api')
        assert.ok(match)
        assert.deepEqual(match.params, { host: 'api.v1' })
      })

      it('excludes unnamed wildcard from params', () => {
        let m = build(['://*.example.com/api'])
        let [match] = m.matchAll('https://api.v1.example.com/api')
        assert.ok(match)
        assert.deepEqual(match.params, {})
      })

      it('matches optional hostname segments when present and absent', () => {
        let m = build(['://api(-:version).example.com/users'])
        let [present] = m.matchAll('https://api-v2.example.com/users')
        assert.ok(present)
        assert.deepEqual(present.params, { version: 'v2' })

        let [absent] = m.matchAll('https://api.example.com/users')
        assert.ok(absent)
        assert.deepEqual(absent.params, { version: undefined })
      })

      it('hostname matching is case-insensitive', () => {
        let m = build(['://Example.COM/users'])
        assert.equal(m.matchAll('https://example.com/users').length, 1)
        assert.equal(m.matchAll('https://EXAMPLE.COM/users').length, 1)
      })
    })

    describe('port', () => {
      it('matches explicit port', () => {
        let m = build(['://example.com:8080/users'])
        assert.equal(m.matchAll('http://example.com:8080/users').length, 1)
      })

      it('returns empty when port mismatches', () => {
        let m = build(['://example.com:8080/users'])
        assert.deepEqual(m.matchAll('http://example.com:3000/users'), [])
        assert.deepEqual(m.matchAll('http://example.com/users'), [])
      })

      it('returns empty when pattern omits port but URL has one', () => {
        let m = build(['://example.com/users'])
        assert.deepEqual(m.matchAll('http://example.com:8080/users'), [])
      })

      it('origin-less pattern matches any port', () => {
        let m = build(['/about'])
        assert.equal(m.matchAll('http://localhost/about').length, 1)
        assert.equal(m.matchAll('http://localhost:44199/about').length, 1)
        assert.equal(m.matchAll('https://example.com:8080/about').length, 1)
      })
    })

    describe('pathname', () => {
      it('matches root pathname when pathname is empty', () => {
        let m = build(['://example.com'])
        assert.equal(m.matchAll('http://example.com/').length, 1)
      })

      it('matches static segments', () => {
        let m = build(['://example.com/users/list'])
        let [match] = m.matchAll('http://example.com/users/list')
        assert.ok(match)
        assert.deepEqual(match.params, {})
      })

      it('returns empty when URL is shorter than pattern', () => {
        let m = build(['://example.com/users/list'])
        assert.deepEqual(m.matchAll('http://example.com/users'), [])
      })

      it('returns empty when trailing slash differs', () => {
        let m = build(['://example.com/users'])
        assert.deepEqual(m.matchAll('http://example.com/users/'), [])
      })

      it('matches variable segments', () => {
        let m = build(['://example.com/users/:id'])
        let [match] = m.matchAll('http://example.com/users/123')
        assert.ok(match)
        assert.deepEqual(match.params, { id: '123' })
      })

      it('matches multiple variables', () => {
        let m = build(['://example.com/users/:userId/posts/:postId'])
        let [match] = m.matchAll('http://example.com/users/42/posts/99')
        assert.ok(match)
        assert.deepEqual(match.params, { userId: '42', postId: '99' })
      })

      it('matches wildcard segments', () => {
        let m = build(['://example.com/files/*path'])
        let [match] = m.matchAll('http://example.com/files/docs/readme.md')
        assert.ok(match)
        assert.deepEqual(match.params, { path: 'docs/readme.md' })
      })

      it('matches wildcard with continuation', () => {
        let m = build(['://example.com/files/*path/status'])
        let [match] = m.matchAll('http://example.com/files/docs/api/status')
        assert.ok(match)
        assert.deepEqual(match.params, { path: 'docs/api' })
      })

      it('matches optional pathname segments when present and absent', () => {
        let m = build(['://example.com/posts(/:lang)'])
        let [present] = m.matchAll('http://example.com/posts/en')
        assert.ok(present)
        assert.deepEqual(present.params, { lang: 'en' })

        let [absent] = m.matchAll('http://example.com/posts')
        assert.ok(absent)
        assert.deepEqual(absent.params, { lang: undefined })
      })

      it('matches nested optionals', () => {
        let m = build(['://example.com/docs(/:version(/:page))'])
        let [all] = m.matchAll('http://example.com/docs/v1/intro')
        assert.deepEqual(all?.params, { version: 'v1', page: 'intro' })

        let [partial] = m.matchAll('http://example.com/docs/v1')
        assert.deepEqual(partial?.params, { version: 'v1', page: undefined })

        let [none] = m.matchAll('http://example.com/docs')
        assert.deepEqual(none?.params, { version: undefined, page: undefined })
      })

      it('matches file-extension optionals', () => {
        let m = build(['://example.com/files/:id(.:format)'])
        let [withExt] = m.matchAll('http://example.com/files/doc123.pdf')
        assert.deepEqual(withExt?.params, { id: 'doc123', format: 'pdf' })

        let [noExt] = m.matchAll('http://example.com/files/doc123')
        assert.deepEqual(noExt?.params, { id: 'doc123', format: undefined })
      })
    })

    describe('search', () => {
      it('matches when no search constraints', () => {
        let m = build(['://example.com/search'])
        assert.equal(m.matchAll('http://example.com/search').length, 1)
        assert.equal(m.matchAll('http://example.com/search?q=test').length, 1)
      })

      it('requires bare parameter to be present', () => {
        let m = build(['://example.com/api?auth'])
        assert.deepEqual(m.matchAll('http://example.com/api'), [])
        assert.deepEqual(m.matchAll('http://example.com/api?other=value'), [])
        assert.equal(m.matchAll('http://example.com/api?auth').length, 1)
        assert.equal(m.matchAll('http://example.com/api?auth=token').length, 1)
      })

      it('matches specific value', () => {
        let m = build(['://example.com/api?format=json'])
        assert.equal(m.matchAll('http://example.com/api?format=json').length, 1)
        assert.deepEqual(m.matchAll('http://example.com/api?format=xml'), [])
      })

      it('matches constraints regardless of order in URL', () => {
        let m = build(['://example.com/api?format=json&version=v1'])
        assert.equal(m.matchAll('http://example.com/api?version=v1&format=json').length, 1)
      })
    })

    describe('multiple matches', () => {
      it('returns every matching pattern (order unspecified)', () => {
        let m = build([
          '://example.com/*path',
          '://example.com/users/:id',
          '://example.com/users/new',
        ])
        let matches = m.matchAll('http://example.com/users/new')
        assert.deepEqual(sources(matches).sort(), [
          '://example.com/*path',
          '://example.com/users/:id',
          '://example.com/users/new',
        ])
      })

      it('returns empty array when no matches', () => {
        let m = build(['://example.com/users', '://example.com/posts'])
        assert.deepEqual(m.matchAll('http://example.com/comments'), [])
      })

      it('returns each variant of a pattern with optionals as one match', () => {
        let m = build(['://example.com/posts(/:lang)'])
        let withLang = m.matchAll('http://example.com/posts/en')
        assert.equal(withLang.length, 1)
        assert.deepEqual(withLang[0].params, { lang: 'en' })

        let withoutLang = m.matchAll('http://example.com/posts')
        assert.equal(withoutLang.length, 1)
        assert.deepEqual(withoutLang[0].params, { lang: undefined })
      })
    })

    describe('ignoreCase', () => {
      it('case-sensitive pathname by default', () => {
        let m = build(['/Posts/:id'])
        assert.deepEqual(m.matchAll('https://example.com/posts/123'), [])
        assert.equal(m.matchAll('https://example.com/Posts/123').length, 1)
      })

      it('ignores pathname case when enabled', () => {
        let m = build(['/Posts/:id'], { ignoreCase: true })
        assert.equal(m.matchAll('https://example.com/posts/123').length, 1)
        assert.equal(m.matchAll('https://example.com/POSTS/123').length, 1)
      })

      it('hostname case-insensitive regardless', () => {
        let m = build(['://Example.COM/users'])
        assert.equal(m.matchAll('https://example.com/users').length, 1)
        assert.equal(m.matchAll('https://EXAMPLE.COM/users').length, 1)
      })

      it('search params case-sensitive regardless', () => {
        let m = build(['/api?Sort'], { ignoreCase: true })
        assert.equal(m.matchAll('https://example.com/api?Sort').length, 1)
        assert.deepEqual(m.matchAll('https://example.com/api?sort'), [])
      })
    })

    describe('paramsMeta', () => {
      it('includes wildcard hostname for pathname-only patterns', () => {
        let m = build(['/users/:id'])
        let [match] = m.matchAll('http://example.com/users/123')
        assert.ok(match)
        assert.deepEqual(match.paramsMeta.hostname, [
          { type: '*', name: '*', value: 'example.com', begin: 0, end: 11 },
        ])
        assert.deepEqual(match.paramsMeta.pathname, [
          { type: ':', name: 'id', value: '123', begin: 6, end: 9 },
        ])
      })

      it('captures hostname and pathname params with metadata', () => {
        let m = build(['://:subdomain.example.com/users/:id'])
        let [match] = m.matchAll('https://api.example.com/users/123')
        assert.ok(match)
        assert.equal(match.paramsMeta.hostname.length, 1)
        assert.equal(match.paramsMeta.hostname[0].name, 'subdomain')
        assert.equal(match.paramsMeta.hostname[0].value, 'api')
        assert.equal(match.paramsMeta.pathname.length, 1)
        assert.equal(match.paramsMeta.pathname[0].name, 'id')
        assert.equal(match.paramsMeta.pathname[0].value, '123')
      })

      it('excludes undefined optional params from metadata', () => {
        let m = build(['://example.com/posts(/:lang)'])
        let [match] = m.matchAll('http://example.com/posts')
        assert.ok(match)
        assert.deepEqual(match.paramsMeta.pathname, [])
      })
    })

    describe('add', () => {
      it('accepts string patterns', () => {
        let matcher = createPatternMatcher<null>()
        matcher.add('/users/:id', null)

        let [match] = matcher.matchAll('http://example.com/users/1')
        assert.ok(match)
        assert.deepEqual(match.params, { id: '1' })
      })

      it('accepts pre-parsed AST', () => {
        let matcher = createPatternMatcher<null>()
        matcher.add(parsePattern('/users/:id'), null)

        let [match] = matcher.matchAll('http://example.com/users/1')
        assert.ok(match)
        assert.deepEqual(match.params, { id: '1' })
      })
    })

    describe('data', () => {
      it('returns the data associated with each pattern', () => {
        let matcher = createPatternMatcher<string>()
        matcher.add('/users/:id', 'users')
        matcher.add('/posts/:id', 'posts')

        let [users] = matcher.matchAll('http://example.com/users/1')
        assert.equal(users?.data, 'users')

        let [posts] = matcher.matchAll('http://example.com/posts/1')
        assert.equal(posts?.data, 'posts')
      })
    })
  })
})

function build(patterns: ReadonlyArray<string>, options?: RoutePatternMatcherOptions) {
  let matcher = createPatternMatcher<null>(options)
  for (let p of patterns) matcher.add(p, null)
  return matcher
}

function sources(matches: ReadonlyArray<RoutePatternMatch<unknown>>): Array<string> {
  return matches.map((m) => serializePattern(m.ast))
}
