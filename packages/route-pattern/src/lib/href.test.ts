import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import dedent from 'dedent'

import { CreateHrefError, createHref } from './href.ts'
import { RoutePattern } from './route-pattern.ts'

describe('createHref', () => {
  function hrefError(type: CreateHrefError['details']['type']) {
    return (error: unknown) => error instanceof CreateHrefError && error.details.type === type
  }

  describe('protocol', () => {
    it('defaults omitted protocol (://) to https', () => {
      assert.equal(createHref('://example.com/path'), 'https://example.com/path')
    })

    it('defaults http(s) to https', () => {
      assert.equal(createHref('http(s)://example.com/path'), 'https://example.com/path')
    })

    it('supports explicit http', () => {
      assert.equal(createHref('http://example.com/path'), 'http://example.com/path')
    })

    it('supports explicit https', () => {
      assert.equal(createHref('https://example.com/path'), 'https://example.com/path')
    })
  })

  describe('hostname', () => {
    describe('when origin is present', () => {
      it('throws when protocol specified', () => {
        let pattern = 'https://*/path' as const
        // @ts-expect-error - missing hostname
        assert.throws(() => createHref(pattern), hrefError('missing-hostname'))
      })

      it('throws when protocol with named wildcard missing param', () => {
        let pattern = 'http://*host/path' as const
        // @ts-expect-error - missing required param
        assert.throws(() => createHref(pattern), hrefError('missing-params'))
      })

      it('throws when port specified', () => {
        let pattern = '://:8080/path' as const
        assert.throws(() => createHref(pattern), hrefError('missing-hostname'))
      })
    })

    it('supports static hostname', () => {
      let pattern = '://example.com/path' as const
      assert.equal(createHref(pattern), 'https://example.com/path')
      assert.equal(createHref(pattern, {}), 'https://example.com/path')
      assert.equal(createHref(pattern, null), 'https://example.com/path')
      assert.equal(createHref(pattern, undefined), 'https://example.com/path')
    })

    describe('with dynamic segment', () => {
      it('works when provided', () => {
        assert.equal(
          createHref('://:host.com/path', { host: 'example' }),
          'https://example.com/path',
        )
      })

      it('throws when missing', () => {
        let pattern = '://:host/path' as const
        // @ts-expect-error - missing required param
        assert.throws(() => createHref(pattern), hrefError('missing-params'))
      })
    })

    it('supports multiple dynamic segments', () => {
      assert.equal(
        createHref('://:subdomain.:domain.com/path', { subdomain: 'api', domain: 'example' }),
        'https://api.example.com/path',
      )
    })

    it('supports named wildcard', () => {
      assert.equal(
        createHref('://*env.example.com/path', { env: 'staging' }),
        'https://staging.example.com/path',
      )
    })

    it('throws for nameless wildcard', () => {
      let pattern = '://*.example.com/path' as const
      // @ts-expect-error - nameless wildcard
      assert.throws(() => createHref(pattern), hrefError('nameless-wildcard'))
    })

    it('includes optional with static content', () => {
      assert.equal(createHref('://(www.)example.com/path'), 'https://www.example.com/path')
    })
  })

  describe('port', () => {
    it('supports static port', () => {
      assert.equal(createHref('://example.com:8080/path'), 'https://example.com:8080/path')
    })

    it('works with hostname params', () => {
      assert.equal(
        createHref('://:host:8080/path', { host: 'localhost' }),
        'https://localhost:8080/path',
      )
    })
  })

  describe('pathname', () => {
    it('supports static pathname', () => {
      let pattern = '/posts' as const
      assert.equal(createHref(pattern), '/posts')
      assert.equal(createHref(pattern, {}), '/posts')
      assert.equal(createHref(pattern, null), '/posts')
      assert.equal(createHref(pattern, undefined), '/posts')
    })

    it('normalizes static pathname without leading slash', () => {
      assert.equal(createHref('posts'), '/posts')
    })

    describe('with dynamic segment', () => {
      it('works when provided', () => {
        assert.equal(createHref('/posts/:id', { id: '123' }), '/posts/123')
      })

      it('encodes reserved URL syntax in params', () => {
        assert.equal(createHref('/posts/:id', { id: 'a/b?c#d' }), '/posts/a%2Fb%3Fc%23d')
      })

      it('preserves valid path segment syntax in params', () => {
        assert.equal(
          createHref('/packages/:name', { name: '@remix-run:ui' }),
          '/packages/@remix-run:ui',
        )
      })

      it('encodes dot segment params', () => {
        assert.equal(createHref('/posts/:id', { id: '..' }), '/posts/%252E%252E')
      })

      it('works with number params', () => {
        assert.equal(createHref('/posts/:id', { id: 123 }), '/posts/123')
      })

      it('ignores extra params', () => {
        assert.equal(createHref('/posts/:id', { id: '123', page: '2', sort: 'desc' }), '/posts/123')
      })

      it('throws when missing', () => {
        let pattern = '/posts/:id' as const
        // @ts-expect-error - missing required param
        assert.throws(() => createHref(pattern), hrefError('missing-params'))
      })

      it('throws when params is null (required params)', () => {
        let pattern = '/posts/:id' as const
        // @ts-expect-error - null not allowed when required params
        assert.throws(() => createHref(pattern, null), hrefError('missing-params'))
      })

      it('throws when params is undefined (required params)', () => {
        let pattern = '/posts/:id' as const
        // @ts-expect-error - undefined not allowed when required params
        assert.throws(() => createHref(pattern, undefined), hrefError('missing-params'))
      })
    })

    it('supports multiple dynamic segments', () => {
      assert.equal(
        createHref('/users/:userId/posts/:postId', { userId: '42', postId: '123' }),
        '/users/42/posts/123',
      )
    })

    it('supports named wildcard', () => {
      assert.equal(createHref('/files/*path', { path: 'docs/readme.md' }), '/files/docs/readme.md')
      assert.equal(
        createHref('images/*path.png', { path: 'images/hero' }),
        '/images/images/hero.png',
      )
    })

    it('encodes each wildcard path segment independently', () => {
      assert.equal(
        createHref('/files/*path', { path: '../draft docs/readme.md?raw#intro' }),
        '/files/%252E%252E/draft%20docs/readme.md%3Fraw%23intro',
      )
    })

    it('preserves valid wildcard path segment syntax', () => {
      assert.equal(
        createHref('/assets/*path', { path: 'node_modules/@remix-run/ui/jsx-runtime.ts' }),
        '/assets/node_modules/@remix-run/ui/jsx-runtime.ts',
      )
    })

    it('supports wildcard with number param', () => {
      assert.equal(createHref('/files/*path', { path: 123 }), '/files/123')
    })

    it('throws for unnamed wildcard', () => {
      let pattern = '/files/*' as const
      // @ts-expect-error - nameless wildcard
      assert.throws(() => createHref(pattern), hrefError('nameless-wildcard'))
    })

    it('supports repeated params', () => {
      assert.equal(
        createHref('/:lang/users/:userId/:lang/posts/:postId', {
          lang: 'en',
          userId: '42',
          postId: '123',
        }),
        '/en/users/42/en/posts/123',
      )
    })
  })

  describe('pattern with optionals', () => {
    it('includes optional with static content', () => {
      assert.equal(createHref('/posts(/edit)'), '/posts/edit')
      assert.equal(createHref('products(.md)'), '/products.md')
    })

    it('includes optional with variable when provided', () => {
      assert.equal(createHref('/posts(/:id)', { id: '123' }), '/posts/123')
    })

    it('omits optional with variable when omitted', () => {
      let pattern = '/posts(/:id)' as const
      assert.equal(createHref(pattern), '/posts')
      assert.equal(createHref(pattern, {}), '/posts')
      assert.equal(createHref(pattern, null), '/posts')
      assert.equal(createHref(pattern, undefined), '/posts')
    })

    it('includes optional with wildcard when provided', () => {
      assert.equal(
        createHref('/files(/*path)', { path: 'docs/readme.md' }),
        '/files/docs/readme.md',
      )
    })

    it('omits optional with wildcard when omitted', () => {
      let pattern = '/files(/*path)' as const
      assert.equal(createHref(pattern), '/files')
      assert.equal(createHref(pattern, {}), '/files')
      assert.equal(createHref(pattern, null), '/files')
      assert.equal(createHref(pattern, undefined), '/files')
    })

    it('omits optional with nameless wildcard', () => {
      let pattern = '/files(/*)' as const
      assert.equal(createHref(pattern), '/files')
      assert.equal(createHref(pattern, {}), '/files')
      assert.equal(createHref(pattern, null), '/files')
      assert.equal(createHref(pattern, undefined), '/files')
    })

    describe('with nested optionals', () => {
      it('includes all when all provided', () => {
        assert.equal(
          createHref('/blog/:year(/:month(/:day))', {
            year: '2024',
            month: '01',
            day: '15',
          }),
          '/blog/2024/01/15',
        )
      })

      it('includes only outer when inner omitted', () => {
        assert.equal(
          createHref('/blog/:year(/:month(/:day))', { year: '2024', month: '01' }),
          '/blog/2024/01',
        )
      })

      it('omits both when only inner provided', () => {
        assert.equal(
          createHref('/blog/:year(/:month(/:day))', { year: '2024', day: '15' }),
          '/blog/2024',
        )
      })

      it('omits both when neither provided', () => {
        assert.equal(createHref('/blog/:year(/:month(/:day))', { year: '2024' }), '/blog/2024')
      })
    })

    describe('with multiple optionals', () => {
      it('includes both when both provided', () => {
        assert.equal(
          createHref('/posts(/:id)(/:action)', { id: '123', action: 'edit' }),
          '/posts/123/edit',
        )
      })

      it('includes only first when second omitted', () => {
        assert.equal(createHref('/posts(/:id)(/:action)', { id: '123' }), '/posts/123')
      })

      it('includes only second when first omitted', () => {
        assert.equal(createHref('/posts(/:id)(/:action)', { action: 'edit' }), '/posts/edit')
      })

      it('omits both when neither provided', () => {
        assert.equal(createHref('/posts(/:id)(/:action)'), '/posts')
      })
    })

    it('normalizes to slash when entire pattern is omitted optional', () => {
      assert.equal(createHref('(/:locale)(/:page)'), '/')
    })
  })

  describe('search params', () => {
    it('works with no constraints', () => {
      assert.equal(
        createHref('/posts', undefined, { category: ['books', 'electronics'] }),
        '/posts?category=books&category=electronics',
      )
    })

    describe('with key-only constraint (?q)', () => {
      it('includes empty value without user param', () => {
        assert.equal(createHref('/posts?filter'), '/posts?filter=')
      })

      it('uses user param value', () => {
        assert.equal(
          createHref('/posts?filter', undefined, { filter: 'active' }),
          '/posts?filter=active',
        )
      })
    })

    describe('with specific-value constraint (?q=foo)', () => {
      it('uses pattern value only', () => {
        assert.equal(createHref('/posts?sort=asc'), '/posts?sort=asc')
      })

      it('preserves pattern search when only path params passed', () => {
        assert.equal(createHref('products?sort=asc&limit'), '/products?sort=asc&limit=')
        assert.equal(
          createHref('products/:id?sort=asc&limit', { id: '1' }),
          '/products/1?sort=asc&limit=',
        )
      })

      it('prepends user params', () => {
        assert.equal(
          createHref('/posts?sort=asc', undefined, { sort: 'desc' }),
          '/posts?sort=desc&sort=asc',
        )
      })

      it('deduplicates when user matches pattern', () => {
        assert.equal(
          createHref('/posts?tag=featured', undefined, { tag: 'featured' }),
          '/posts?tag=featured',
        )
      })

      it('deduplicates when user matches one of multiple pattern values', () => {
        assert.equal(
          createHref('/posts?tag=featured&tag=popular', undefined, {
            tag: 'featured',
          }),
          '/posts?tag=featured&tag=popular',
        )
      })

      it('handles array values', () => {
        assert.equal(
          createHref('/posts?tag=featured&tag=popular', undefined, {
            tag: ['tutorial', 'beginner'],
          }),
          '/posts?tag=tutorial&tag=beginner&tag=featured&tag=popular',
        )
      })
    })

    it('supports additional user params', () => {
      assert.equal(
        createHref('/posts?sort=asc', undefined, { page: '2' }),
        '/posts?page=2&sort=asc',
      )
    })
  })

  describe('format', () => {
    it('returns relative URL for pathname only', () => {
      assert.equal(createHref('/posts/:id', { id: '123' }), '/posts/123')
    })

    it('returns absolute URL with protocol', () => {
      assert.equal(createHref('https://example.com/path'), 'https://example.com/path')
    })

    it('returns absolute URL with hostname', () => {
      assert.equal(createHref('://example.com/path'), 'https://example.com/path')
    })

    it('returns absolute URL with port', () => {
      assert.equal(createHref('://example.com:8080/path'), 'https://example.com:8080/path')
    })
  })
})

describe('CreateHrefError', () => {
  describe('missing-hostname', () => {
    it('shows pattern', () => {
      let pattern = RoutePattern.parse('https://*:8080/api')
      let error = new CreateHrefError({ type: 'missing-hostname', pattern })
      assert.equal(
        error.toString(),
        dedent`
          CreateHrefError: pattern requires hostname

          Pattern: https://:8080/api
        `,
      )
    })
  })

  describe('missing-params', () => {
    it('shows missing param, pattern, and params', () => {
      let pattern = RoutePattern.parse('https://example.com/:collection/:id')
      let error = new CreateHrefError({
        type: 'missing-params',
        pattern,
        part: pattern.pathname,
        missingParams: ['collection', 'id'],
        params: {},
      })
      assert.equal(
        error.toString(),
        dedent`
          CreateHrefError: missing param(s): 'collection', 'id'

          Pattern: https://example.com/:collection/:id
          Params: {}
        `,
      )
    })
  })

  describe('nameless-wildcard', () => {
    it('shows error message with pattern', () => {
      let pattern = RoutePattern.parse('https://example.com/api/*/users')
      let error = new CreateHrefError({ type: 'nameless-wildcard', pattern })
      assert.equal(
        error.toString(),
        dedent`
          CreateHrefError: pattern contains nameless wildcard

          Pattern: https://example.com/api/*/users
        `,
      )
    })
  })
})
