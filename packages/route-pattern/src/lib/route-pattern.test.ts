import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createHref, type CreateHrefErrorDetails } from '../href.ts'
import { joinPatterns } from '../join.ts'
import { createMatcher, type MatchParamMeta } from '../match.ts'
import {
  getRoutePatternParams,
  RoutePattern,
  type RoutePatternJSON,
  type RoutePatternParam,
} from '../route-pattern.ts'

describe('RoutePattern', () => {
  it('exports public route pattern support types', () => {
    let param: RoutePatternParam = {
      part: 'pathname',
      type: ':',
      name: 'id',
      optional: false,
    }
    let json: RoutePatternJSON = {
      protocol: '',
      hostname: '',
      port: '',
      pathname: ':id',
      search: '',
    }
    let hrefError: CreateHrefErrorDetails = {
      type: 'missing-hostname',
      pattern: RoutePattern.parse('https://'),
    }
    let matchMeta: MatchParamMeta = {
      type: ':',
      name: 'id',
      value: '123',
      begin: 0,
      end: 3,
    }

    assert.equal(param.name, 'id')
    assert.equal(json.pathname, ':id')
    assert.equal(hrefError.type, 'missing-hostname')
    assert.equal(matchMeta.value, '123')
  })

  it('does not expose parsed-AST construction', () => {
    assert.throws(
      () => {
        // @ts-expect-error - RoutePattern construction is internal
        new RoutePattern({})
      },
      {
        name: 'TypeError',
        message: 'RoutePattern constructor is private; use RoutePattern.parse()',
      },
    )
  })

  it('brands source generics nominally', () => {
    let posts = RoutePattern.parse('/posts/:postId')

    // @ts-expect-error - incompatible RoutePattern source
    let users: RoutePattern<'/users/:userId'> = posts

    assert.equal(users, posts)
  })

  it('exposes params without exposing parsed tokens', () => {
    let pattern = RoutePattern.parse('https://:tenant.example.com/:collection(/*path)(.:ext)')

    assert.deepEqual(getRoutePatternParams(pattern), [
      { part: 'hostname', type: ':', name: 'tenant', optional: false },
      { part: 'pathname', type: ':', name: 'collection', optional: false },
      { part: 'pathname', type: '*', name: 'path', optional: true },
      { part: 'pathname', type: ':', name: 'ext', optional: true },
    ])
  })

  it('exposes unnamed wildcards in params', () => {
    let pattern = RoutePattern.parse('/files/*')

    assert.deepEqual(getRoutePatternParams(pattern), [
      { part: 'pathname', type: '*', name: '*', optional: false },
    ])
  })

  it('infers createHref params from parsed patterns', () => {
    let pattern = RoutePattern.parse('/posts/:postId')

    assert.equal(createHref(pattern, { postId: '123' }), '/posts/123')

    // @ts-expect-error - params come from the parsed pattern source
    assert.throws(() => createHref(pattern, { userId: '123' }))
  })

  it('infers matcher params from parsed patterns', () => {
    let pattern = RoutePattern.parse('/posts/:postId')
    let matcher = createMatcher(pattern)
    let match = matcher.match('https://remix.run/posts/123')

    if (!match) throw new Error('Expected match')
    assert.equal(match.params.postId, '123')
  })

  it('infers joined params from parsed patterns without reparsing them', () => {
    let base = RoutePattern.parse('/orgs/:orgId')
    let next = RoutePattern.parse('/repos/:repoId')
    let parse = RoutePattern.parse

    RoutePattern.parse = function parse<source extends string>(
      source: source,
    ): RoutePattern<source> {
      throw new Error(`unexpected reparse: ${source}`)
    }

    try {
      let joined = joinPatterns(base, next)

      assert.equal(
        createHref(joined, { orgId: 'remix-run', repoId: 'remix' }),
        '/orgs/remix-run/repos/remix',
      )

      // @ts-expect-error - joined pattern requires both params
      assert.throws(() => createHref(joined, { orgId: 'remix-run' }))
    } finally {
      RoutePattern.parse = parse
    }
  })
})
