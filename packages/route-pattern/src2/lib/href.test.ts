import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { RoutePatternHrefError, toHref } from './href.ts'
import { parsePattern } from './parse.ts'

describe('toHref', () => {
  function hrefError(type: RoutePatternHrefError['details']['type']) {
    return (error: unknown) => error instanceof RoutePatternHrefError && error.details.type === type
  }

  describe('protocol', () => {
    it('defaults omitted protocol (://) to https', () => {
      assert.equal(toHref(parsePattern('://example.com/path')), 'https://example.com/path')
    })

    it('defaults http(s) to https', () => {
      assert.equal(toHref(parsePattern('http(s)://example.com/path')), 'https://example.com/path')
    })

    it('supports explicit http', () => {
      assert.equal(toHref(parsePattern('http://example.com/path')), 'http://example.com/path')
    })

    it('supports explicit https', () => {
      assert.equal(toHref(parsePattern('https://example.com/path')), 'https://example.com/path')
    })
  })

  describe('hostname', () => {
    describe('when origin is present', () => {
      it('throws when protocol specified', () => {
        let ast = parsePattern('https://*/path')
        // @ts-expect-error - missing hostname
        assert.throws(() => toHref(ast), hrefError('missing-hostname'))
      })

      it('throws when protocol with named wildcard missing param', () => {
        let ast = parsePattern('http://*host/path')
        // @ts-expect-error - missing required param
        assert.throws(() => toHref(ast), hrefError('missing-params'))
      })

      it('throws when port specified', () => {
        let ast = parsePattern('://:8080/path')
        assert.throws(() => toHref(ast), hrefError('missing-hostname'))
      })
    })

    it('supports static hostname', () => {
      let ast = parsePattern('://example.com/path')
      assert.equal(toHref(ast), 'https://example.com/path')
      assert.equal(toHref(ast, {}), 'https://example.com/path')
      assert.equal(toHref(ast, null), 'https://example.com/path')
      assert.equal(toHref(ast, undefined), 'https://example.com/path')
    })

    describe('with dynamic segment', () => {
      it('works when provided', () => {
        let ast = parsePattern('://:host.com/path')
        assert.equal(toHref(ast, { host: 'example' }), 'https://example.com/path')
      })

      it('throws when missing', () => {
        let ast = parsePattern('://:host/path')
        // @ts-expect-error - missing required param
        assert.throws(() => toHref(ast), hrefError('missing-params'))
      })
    })

    it('supports multiple dynamic segments', () => {
      let ast = parsePattern('://:subdomain.:domain.com/path')
      assert.equal(
        toHref(ast, { subdomain: 'api', domain: 'example' }),
        'https://api.example.com/path',
      )
    })

    it('supports named wildcard', () => {
      let ast = parsePattern('://*env.example.com/path')
      assert.equal(toHref(ast, { env: 'staging' }), 'https://staging.example.com/path')
    })

    it('throws for nameless wildcard', () => {
      let ast = parsePattern('://*.example.com/path')
      // @ts-expect-error - nameless wildcard
      assert.throws(() => toHref(ast), hrefError('nameless-wildcard'))
    })

    it('includes optional with static content', () => {
      assert.equal(
        toHref(parsePattern('://(www.)example.com/path')),
        'https://www.example.com/path',
      )
    })
  })

  describe('port', () => {
    it('supports static port', () => {
      assert.equal(
        toHref(parsePattern('://example.com:8080/path')),
        'https://example.com:8080/path',
      )
    })

    it('works with hostname params', () => {
      let ast = parsePattern('://:host:8080/path')
      assert.equal(toHref(ast, { host: 'localhost' }), 'https://localhost:8080/path')
    })
  })

  describe('pathname', () => {
    it('supports static pathname', () => {
      let ast = parsePattern('/posts')
      assert.equal(toHref(ast), '/posts')
      assert.equal(toHref(ast, {}), '/posts')
      assert.equal(toHref(ast, null), '/posts')
      assert.equal(toHref(ast, undefined), '/posts')
    })

    it('normalizes static pathname without leading slash', () => {
      assert.equal(toHref(parsePattern('posts')), '/posts')
    })

    describe('with dynamic segment', () => {
      it('works when provided', () => {
        assert.equal(toHref(parsePattern('/posts/:id'), { id: '123' }), '/posts/123')
      })

      it('works with number params', () => {
        assert.equal(toHref(parsePattern('/posts/:id'), { id: 123 }), '/posts/123')
      })

      it('ignores extra params', () => {
        assert.equal(
          toHref(parsePattern('/posts/:id'), { id: '123', page: '2', sort: 'desc' }),
          '/posts/123',
        )
      })

      it('throws when missing', () => {
        let ast = parsePattern('/posts/:id')
        // @ts-expect-error - missing required param
        assert.throws(() => toHref(ast), hrefError('missing-params'))
      })

      it('throws when params is null (required params)', () => {
        let ast = parsePattern('/posts/:id')
        // @ts-expect-error - null not allowed when required params
        assert.throws(() => toHref(ast, null), hrefError('missing-params'))
      })

      it('throws when params is undefined (required params)', () => {
        let ast = parsePattern('/posts/:id')
        // @ts-expect-error - undefined not allowed when required params
        assert.throws(() => toHref(ast, undefined), hrefError('missing-params'))
      })
    })

    it('supports multiple dynamic segments', () => {
      assert.equal(
        toHref(parsePattern('/users/:userId/posts/:postId'), { userId: '42', postId: '123' }),
        '/users/42/posts/123',
      )
    })

    it('supports named wildcard', () => {
      assert.equal(
        toHref(parsePattern('/files/*path'), { path: 'docs/readme.md' }),
        '/files/docs/readme.md',
      )
      assert.equal(
        toHref(parsePattern('images/*path.png'), { path: 'images/hero' }),
        '/images/images/hero.png',
      )
    })

    it('supports wildcard with number param', () => {
      assert.equal(toHref(parsePattern('/files/*path'), { path: 123 }), '/files/123')
    })

    it('throws for unnamed wildcard', () => {
      let ast = parsePattern('/files/*')
      // @ts-expect-error - nameless wildcard
      assert.throws(() => toHref(ast), hrefError('nameless-wildcard'))
    })

    it('supports repeated params', () => {
      assert.equal(
        toHref(parsePattern('/:lang/users/:userId/:lang/posts/:postId'), {
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
      assert.equal(toHref(parsePattern('/posts(/edit)')), '/posts/edit')
      assert.equal(toHref(parsePattern('products(.md)')), '/products.md')
    })

    it('includes optional with variable when provided', () => {
      assert.equal(toHref(parsePattern('/posts(/:id)'), { id: '123' }), '/posts/123')
    })

    it('omits optional with variable when omitted', () => {
      let ast = parsePattern('/posts(/:id)')
      assert.equal(toHref(ast), '/posts')
      assert.equal(toHref(ast, {}), '/posts')
      assert.equal(toHref(ast, null), '/posts')
      assert.equal(toHref(ast, undefined), '/posts')
    })

    it('includes optional with wildcard when provided', () => {
      assert.equal(
        toHref(parsePattern('/files(/*path)'), { path: 'docs/readme.md' }),
        '/files/docs/readme.md',
      )
    })

    it('omits optional with wildcard when omitted', () => {
      let ast = parsePattern('/files(/*path)')
      assert.equal(toHref(ast), '/files')
      assert.equal(toHref(ast, {}), '/files')
      assert.equal(toHref(ast, null), '/files')
      assert.equal(toHref(ast, undefined), '/files')
    })

    it('omits optional with nameless wildcard', () => {
      let ast = parsePattern('/files(/*)')
      assert.equal(toHref(ast), '/files')
      assert.equal(toHref(ast, {}), '/files')
      assert.equal(toHref(ast, null), '/files')
      assert.equal(toHref(ast, undefined), '/files')
    })

    describe('with nested optionals', () => {
      it('includes all when all provided', () => {
        assert.equal(
          toHref(parsePattern('/blog/:year(/:month(/:day))'), {
            year: '2024',
            month: '01',
            day: '15',
          }),
          '/blog/2024/01/15',
        )
      })

      it('includes only outer when inner omitted', () => {
        assert.equal(
          toHref(parsePattern('/blog/:year(/:month(/:day))'), { year: '2024', month: '01' }),
          '/blog/2024/01',
        )
      })

      it('omits both when only inner provided', () => {
        assert.equal(
          toHref(parsePattern('/blog/:year(/:month(/:day))'), { year: '2024', day: '15' }),
          '/blog/2024',
        )
      })

      it('omits both when neither provided', () => {
        assert.equal(
          toHref(parsePattern('/blog/:year(/:month(/:day))'), { year: '2024' }),
          '/blog/2024',
        )
      })
    })

    describe('with multiple optionals', () => {
      it('includes both when both provided', () => {
        assert.equal(
          toHref(parsePattern('/posts(/:id)(/:action)'), { id: '123', action: 'edit' }),
          '/posts/123/edit',
        )
      })

      it('includes only first when second omitted', () => {
        assert.equal(toHref(parsePattern('/posts(/:id)(/:action)'), { id: '123' }), '/posts/123')
      })

      it('includes only second when first omitted', () => {
        assert.equal(
          toHref(parsePattern('/posts(/:id)(/:action)'), { action: 'edit' }),
          '/posts/edit',
        )
      })

      it('omits both when neither provided', () => {
        assert.equal(toHref(parsePattern('/posts(/:id)(/:action)')), '/posts')
      })
    })

    it('normalizes to slash when entire pattern is omitted optional', () => {
      assert.equal(toHref(parsePattern('(/:locale)(/:page)')), '/')
    })
  })

  describe('search params', () => {
    it('works with no constraints', () => {
      assert.equal(
        toHref(parsePattern('/posts'), undefined, { category: ['books', 'electronics'] }),
        '/posts?category=books&category=electronics',
      )
    })

    describe('with key-only constraint (?q)', () => {
      it('includes empty value without user param', () => {
        assert.equal(toHref(parsePattern('/posts?filter')), '/posts?filter=')
      })

      it('uses user param value', () => {
        assert.equal(
          toHref(parsePattern('/posts?filter'), undefined, { filter: 'active' }),
          '/posts?filter=active',
        )
      })
    })

    describe('with specific-value constraint (?q=foo)', () => {
      it('uses pattern value only', () => {
        assert.equal(toHref(parsePattern('/posts?sort=asc')), '/posts?sort=asc')
      })

      it('preserves pattern search when only path params passed', () => {
        assert.equal(toHref(parsePattern('products?sort=asc&limit')), '/products?sort=asc&limit=')
        assert.equal(
          toHref(parsePattern('products/:id?sort=asc&limit'), { id: '1' }),
          '/products/1?sort=asc&limit=',
        )
      })

      it('prepends user params', () => {
        assert.equal(
          toHref(parsePattern('/posts?sort=asc'), undefined, { sort: 'desc' }),
          '/posts?sort=desc&sort=asc',
        )
      })

      it('deduplicates when user matches pattern', () => {
        assert.equal(
          toHref(parsePattern('/posts?tag=featured'), undefined, { tag: 'featured' }),
          '/posts?tag=featured',
        )
      })

      it('deduplicates when user matches one of multiple pattern values', () => {
        assert.equal(
          toHref(parsePattern('/posts?tag=featured&tag=popular'), undefined, { tag: 'featured' }),
          '/posts?tag=featured&tag=popular',
        )
      })

      it('handles array values', () => {
        assert.equal(
          toHref(parsePattern('/posts?tag=featured&tag=popular'), undefined, {
            tag: ['tutorial', 'beginner'],
          }),
          '/posts?tag=tutorial&tag=beginner&tag=featured&tag=popular',
        )
      })
    })

    it('supports additional user params', () => {
      assert.equal(
        toHref(parsePattern('/posts?sort=asc'), undefined, { page: '2' }),
        '/posts?page=2&sort=asc',
      )
    })
  })

  describe('format', () => {
    it('returns relative URL for pathname only', () => {
      assert.equal(toHref(parsePattern('/posts/:id'), { id: '123' }), '/posts/123')
    })

    it('returns absolute URL with protocol', () => {
      assert.equal(toHref(parsePattern('https://example.com/path')), 'https://example.com/path')
    })

    it('returns absolute URL with hostname', () => {
      assert.equal(toHref(parsePattern('://example.com/path')), 'https://example.com/path')
    })

    it('returns absolute URL with port', () => {
      assert.equal(
        toHref(parsePattern('://example.com:8080/path')),
        'https://example.com:8080/path',
      )
    })
  })
})
