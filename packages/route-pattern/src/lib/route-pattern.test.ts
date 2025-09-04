import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { RoutePattern } from './route-pattern.ts'

describe('RoutePattern', () => {
  describe('constructor', () => {
    it('stores the source pattern', () => {
      let pattern = new RoutePattern('users/:id')
      assert.equal(pattern.source, 'users/:id')
    })

    it('can be created from another pattern', () => {
      let pattern = new RoutePattern('users/:id')
      let pattern2 = new RoutePattern(pattern)
      assert.equal(pattern2.source, pattern.source)
    })
  })

  describe('match', () => {
    describe('pathname only patterns', () => {
      it('matches plain text', () => {
        let pattern = new RoutePattern('users')
        assert.deepEqual(pattern.match('https://example.com/users')?.params, {})
      })

      it('returns null for non-matching text', () => {
        let pattern = new RoutePattern('users')
        assert.deepEqual(pattern.match('https://example.com/posts'), null)
      })

      it('extracts named parameters', () => {
        let pattern = new RoutePattern('users/:id')
        assert.deepEqual(pattern.match('https://example.com/users/123')?.params, { id: '123' })
      })

      it('extracts multiple parameters', () => {
        let pattern = new RoutePattern('users/:userId/posts/:postId')
        assert.deepEqual(pattern.match('https://example.com/users/123/posts/456')?.params, {
          userId: '123',
          postId: '456',
        })
      })

      it('extracts named parameters - required', () => {
        let pattern = new RoutePattern('users/:id')
        assert.deepEqual(pattern.match('https://example.com/users/123')?.params, { id: '123' })
      })

      it('extracts parameters with complex names', () => {
        let pattern = new RoutePattern('users/:user_id/posts/:$post')
        assert.deepEqual(pattern.match('https://example.com/users/abc123/posts/def456')?.params, {
          user_id: 'abc123',
          $post: 'def456',
        })
      })

      it('extracts named wildcards', () => {
        let pattern = new RoutePattern('assets/*path')
        assert.deepEqual(pattern.match('https://example.com/assets/images/logo.png')?.params, {
          path: 'images/logo.png',
        })
      })

      it('extracts named wildcards - required', () => {
        let pattern = new RoutePattern('assets/*path')
        assert.deepEqual(pattern.match('https://example.com/assets/images/logo.png')?.params, {
          path: 'images/logo.png',
        })
      })

      it('matches optional sections when present', () => {
        let pattern = new RoutePattern('api(/:version)')
        assert.deepEqual(pattern.match('https://example.com/api/v1')?.params, { version: 'v1' })
      })

      it('matches optional sections when absent', () => {
        let pattern = new RoutePattern('api(/:version)')
        assert.deepEqual(pattern.match('https://example.com/api')?.params, { version: undefined })
      })

      it('matches complex optional patterns - with format', () => {
        let pattern = new RoutePattern('users/:id(.:format)')
        assert.deepEqual(pattern.match('https://example.com/users/123.json')?.params, {
          id: '123',
          format: 'json',
        })
      })

      it('matches complex optional patterns - without format', () => {
        let pattern = new RoutePattern('users/:id(.:format)')
        assert.deepEqual(pattern.match('https://example.com/users/123')?.params, {
          id: '123',
          format: undefined,
        })
      })

      it('matches nested optional sections when present', () => {
        let pattern = new RoutePattern('api(/:major(/:minor))')
        assert.deepEqual(pattern.match('https://example.com/api/v2/1')?.params, {
          major: 'v2',
          minor: '1',
        })
      })

      it('matches nested optional sections when partially present', () => {
        let pattern = new RoutePattern('api(/:major(/:minor))')
        assert.deepEqual(pattern.match('https://example.com/api/v2')?.params, {
          major: 'v2',
          minor: undefined,
        })
      })

      it('matches nested optional sections when absent', () => {
        let pattern = new RoutePattern('api(/:major(/:minor))')
        assert.deepEqual(pattern.match('https://example.com/api')?.params, {
          major: undefined,
          minor: undefined,
        })
      })

      it('matches nested optionals with wildcard and variable', () => {
        let pattern = new RoutePattern('files(/*path(.:ext))')
        // Wildcard is greedy; when ext group is optional, wildcard consumes the suffix
        assert.deepEqual(pattern.match('https://example.com/files/docs/readme.md')?.params, {
          path: 'docs/readme.md',
          ext: undefined,
        })
        assert.deepEqual(pattern.match('https://example.com/files/docs/readme')?.params, {
          path: 'docs/readme',
          ext: undefined,
        })
        assert.deepEqual(pattern.match('https://example.com/files')?.params, {
          path: undefined,
          ext: undefined,
        })
      })

      it('matches nested optionals with unnamed wildcard and variable', () => {
        let pattern = new RoutePattern('files(/*(.:ext))')
        // Unnamed wildcard is greedy and not captured
        assert.deepEqual(pattern.match('https://example.com/files/docs/readme.md')?.params, {
          ext: undefined,
        })
        assert.deepEqual(pattern.match('https://example.com/files/docs/readme')?.params, {
          ext: undefined,
        })
        assert.deepEqual(pattern.match('https://example.com/files')?.params, { ext: undefined })
      })

      it('matches nested optionals mixing variable then wildcard', () => {
        let pattern = new RoutePattern('blog(/:slug(/*rest))')
        assert.deepEqual(pattern.match('https://example.com/blog/post/a/b')?.params, {
          slug: 'post',
          rest: 'a/b',
        })
        assert.deepEqual(pattern.match('https://example.com/blog/post')?.params, {
          slug: 'post',
          rest: undefined,
        })
        assert.deepEqual(pattern.match('https://example.com/blog')?.params, {
          slug: undefined,
          rest: undefined,
        })
      })

      it('handles mixed parameters and text', () => {
        let pattern = new RoutePattern('api/v:version/users/:id')
        assert.deepEqual(pattern.match('https://example.com/api/v2/users/123')?.params, {
          version: '2',
          id: '123',
        })
      })

      it('handles escaped characters', () => {
        let pattern = new RoutePattern('users\\:test')
        assert.deepEqual(pattern.match('https://example.com/users:test')?.params, {})
      })

      it('matches unnamed wildcard without capturing', () => {
        let pattern = new RoutePattern('files/*.jpg')
        assert.deepEqual(pattern.match('https://example.com/files/logo/remix.jpg')?.params, {})
      })

      it('does not match different extension', () => {
        let pattern = new RoutePattern('files/*.jpg')
        assert.deepEqual(pattern.match('https://example.com/files/logo.png'), null)
      })
    })

    describe('duplicate variable names', () => {
      it('uses the right-most param value', () => {
        let pattern = new RoutePattern('api/:id/users/:id')
        let match = pattern.match('https://example.com/api/123/users/456')
        assert.deepEqual(match?.params, { id: '456' })
      })
    })

    describe('enums', () => {
      it('matches simple enum values', () => {
        let pattern = new RoutePattern('files/:name.{jpg,png,gif}')
        assert.deepEqual(pattern.match('https://example.com/files/logo.png')?.params, {
          name: 'logo',
        })
      })

      it('returns null for non-matching enum values', () => {
        let pattern = new RoutePattern('files/:name.{jpg,png,gif}')
        assert.deepEqual(pattern.match('https://example.com/files/logo.css'), null)
      })

      it('matches enum at start of path', () => {
        let pattern = new RoutePattern('{api,admin}/users')
        assert.deepEqual(pattern.match('https://example.com/api/users')?.params, {})
      })

      it('matches enum in middle of path', () => {
        let pattern = new RoutePattern('assets/{images,styles}/file.ext')
        assert.deepEqual(pattern.match('https://example.com/assets/styles/file.ext')?.params, {})
      })

      it('matches single-member enum', () => {
        let pattern = new RoutePattern('api/{v1}/users')
        assert.deepEqual(pattern.match('https://example.com/api/v1/users')?.params, {})
      })

      it('combines enum with wildcards', () => {
        let pattern = new RoutePattern('assets/*path.{jpg,png,gif,svg}')
        assert.deepEqual(
          pattern.match('https://example.com/assets/images/logos/remix.svg')?.params,
          { path: 'images/logos/remix' },
        )
      })

      it('enum with optional sections', () => {
        let pattern = new RoutePattern('api/{json,xml}(/:version)')
        assert.deepEqual(pattern.match('https://example.com/api/json/v2')?.params, {
          version: 'v2',
        })
      })

      it('enum with optional sections - absent', () => {
        let pattern = new RoutePattern('api/{json,xml}(/:version)')
        assert.deepEqual(pattern.match('https://example.com/api/xml')?.params, {
          version: undefined,
        })
      })
    })

    describe('multiple params in single segment', () => {
      it('extracts multiple params with dots', () => {
        let pattern = new RoutePattern('api/v:major.:minor')
        assert.deepEqual(pattern.match('https://example.com/api/v2.1')?.params, {
          major: '2',
          minor: '1',
        })
      })

      it('extracts multiple params with dashes', () => {
        let pattern = new RoutePattern('blog/:year-:month-:day')
        assert.deepEqual(pattern.match('https://example.com/blog/2024-01-15')?.params, {
          year: '2024',
          month: '01',
          day: '15',
        })
      })

      it('extracts multiple params with mixed separators', () => {
        let pattern = new RoutePattern('users/@:username.:format')
        assert.deepEqual(pattern.match('https://example.com/users/@sarah.json')?.params, {
          username: 'sarah',
          format: 'json',
        })
      })

      it('handles params with static prefix', () => {
        let pattern = new RoutePattern('users/@:id')
        assert.deepEqual(pattern.match('https://example.com/users/@sarah')?.params, { id: 'sarah' })
      })

      it('handles params with static suffix', () => {
        let pattern = new RoutePattern('products/:name-shoes')
        assert.deepEqual(pattern.match('https://example.com/products/tennis-shoes')?.params, {
          name: 'tennis',
        })
      })

      it('complex pattern with multiple params and text', () => {
        let pattern = new RoutePattern('api/v:major.:minor/users/:id/:action')
        assert.deepEqual(pattern.match('https://example.com/api/v2.1/users/123/edit')?.params, {
          major: '2',
          minor: '1',
          id: '123',
          action: 'edit',
        })
      })
    })

    describe('full URL patterns', () => {
      it('matches protocol patterns', () => {
        let pattern = new RoutePattern('https://example.com')
        assert.deepEqual(pattern.match('https://example.com/')?.params, {})
      })

      it('ignores case when matching protocol', () => {
        let pattern = new RoutePattern('HTTPS://example.com')
        assert.deepEqual(pattern.match('https://example.com/')?.params, {})
      })

      it('extracts protocol parameters', () => {
        let pattern = new RoutePattern(':protocol://example.com')
        assert.deepEqual(pattern.match('https://example.com/')?.params, { protocol: 'https' })
      })

      it('matches hostname patterns', () => {
        let pattern = new RoutePattern('://example.com')
        assert.deepEqual(pattern.match('https://example.com/')?.params, {})
      })

      it('ignores case when matching hostname', () => {
        let pattern = new RoutePattern('://EXAMPLE.com')
        assert.deepEqual(pattern.match('https://example.com/')?.params, {})
      })

      it('extracts hostname parameters', () => {
        let pattern = new RoutePattern('://:subdomain.example.com')
        assert.deepEqual(pattern.match('https://api.example.com/')?.params, { subdomain: 'api' })
      })

      it('matches complex hostname patterns', () => {
        let pattern = new RoutePattern('://:tenant.app.example.com')
        assert.deepEqual(pattern.match('https://acme.app.example.com/')?.params, { tenant: 'acme' })
      })

      it('combines protocol, hostname, and pathname', () => {
        let pattern = new RoutePattern(':protocol://:subdomain.example.com/api/:version')
        assert.deepEqual(pattern.match('https://api.example.com/api/v1')?.params, {
          protocol: 'https',
          subdomain: 'api',
          version: 'v1',
        })
      })

      it('matches when pattern specifies a fixed port', () => {
        let pattern = new RoutePattern('://example.com:8080/api/:id')
        assert.deepEqual(pattern.match('https://example.com:8080/api/123')?.params, { id: '123' })
      })

      it('returns null when port does not match fixed port', () => {
        let pattern = new RoutePattern('://example.com:8080/api/:id')
        assert.deepEqual(pattern.match('https://example.com:3000/api/123'), null)
      })

      it('handles optional sections in full URLs', () => {
        let pattern = new RoutePattern('https://:tenant.example.com/users/:id')
        assert.deepEqual(pattern.match('https://acme.example.com/users/123')?.params, {
          tenant: 'acme',
          id: '123',
        })
      })

      it('handles wildcards in hostnames', () => {
        let pattern = new RoutePattern('://*host.example.com')
        assert.deepEqual(pattern.match('https://api.v1.example.com/')?.params, { host: 'api.v1' })
      })

      it('handles unnamed wildcards in hostnames without capturing', () => {
        let pattern = new RoutePattern('://*.example.com')
        assert.deepEqual(pattern.match('https://api.v1.example.com/')?.params, {})
      })

      it('handles multi-tenant with optional admin path', () => {
        let pattern = new RoutePattern('://:tenant.remix.run/(:admin/)users/:id')
        assert.deepEqual(pattern.match('https://acme.remix.run/users/123')?.params, {
          tenant: 'acme',
          admin: undefined,
          id: '123',
        })
      })
    })

    describe('input types', () => {
      it('accepts string URLs', () => {
        let pattern = new RoutePattern('users/:id')
        assert.deepEqual(pattern.match('https://example.com/users/123')?.params, { id: '123' })
      })

      it('accepts URL objects', () => {
        let pattern = new RoutePattern('users/:id')
        assert.deepEqual(pattern.match(new URL('https://example.com/users/123'))?.params, {
          id: '123',
        })
      })
    })

    describe('edge cases', () => {
      it('handles empty patterns', () => {
        let pattern = new RoutePattern('')
        assert.deepEqual(pattern.match('https://example.com/')?.params, {})
      })

      it('handles root path', () => {
        let pattern = new RoutePattern('/')
        assert.deepEqual(pattern.match('https://example.com/'), {
          url: new URL('https://example.com/'),
          params: {},
        })
      })

      it('handles patterns with no pathname', () => {
        let pattern = new RoutePattern('https://example.com')
        assert.deepEqual(pattern.match('https://example.com/')?.params, {})
      })

      it('returns null for mismatched protocols', () => {
        let pattern = new RoutePattern('https://example.com')
        assert.deepEqual(pattern.match('http://example.com/'), null)
      })

      it('returns null for mismatched hostnames', () => {
        let pattern = new RoutePattern('://example.com')
        assert.deepEqual(pattern.match('https://other.com/'), null)
      })

      it('returns null for mismatched paths', () => {
        let pattern = new RoutePattern('users/:id')
        assert.deepEqual(pattern.match('https://example.com/posts/123'), null)
      })

      it('handles special characters in URLs', () => {
        let pattern = new RoutePattern('search/:query')
        assert.deepEqual(pattern.match('https://example.com/search/hello%20world')?.params, {
          query: 'hello%20world',
        })
      })

      it('handles wildcards that look like paths', () => {
        let pattern = new RoutePattern('proxy/*url')
        assert.deepEqual(pattern.match('https://example.com/proxy/https://other.com/api')?.params, {
          url: 'https://other.com/api',
        })
      })
    })

    describe('optionals', () => {
      it('matches optional hostname sections when present', () => {
        let pattern = new RoutePattern('://(:subdomain.)example.com/:version')
        let params = pattern.match('https://api.example.com/v1')?.params
        assert.ok(params)
        assert.ok('subdomain' in params)
        assert.equal(params.subdomain, 'api')
        assert.ok('version' in params)
        assert.equal(params.version, 'v1')
      })

      it('matches optional hostname sections when absent', () => {
        let pattern = new RoutePattern('://(:subdomain.)example.com/:version')
        let params = pattern.match('https://example.com/v1')?.params
        assert.ok(params)
        assert.ok('subdomain' in params)
        assert.equal(params.subdomain, undefined)
        assert.ok('version' in params)
        assert.equal(params.version, 'v1')
      })

      it('matches optional pathname sections when present', () => {
        let pattern = new RoutePattern('api(/:version)')
        let params = pattern.match('https://example.com/api/v1')?.params
        assert.ok(params)
        assert.ok('version' in params)
        assert.equal(params.version, 'v1')
      })

      it('matches optional pathname sections when absent', () => {
        let pattern = new RoutePattern('api(/:version)')
        let params = pattern.match('https://example.com/api')?.params
        assert.ok(params)
        assert.ok('version' in params)
        assert.equal(params.version, undefined)
      })
    })

    describe('variable constraints', () => {
      it('does not match hostname variables across dots', () => {
        let pattern = new RoutePattern('://:subdomain.example.com')
        assert.deepEqual(pattern.match('https://api.v1.example.com/'), null)
      })

      it('does not match variables across path segments', () => {
        let pattern = new RoutePattern('users/:id/posts')
        assert.deepEqual(pattern.match('https://example.com/users/123/456/posts'), null)
      })

      it('matches wildcards across segments', () => {
        let pattern = new RoutePattern('files/*path')
        assert.deepEqual(pattern.match('https://example.com/files/docs/readme.txt')?.params, {
          path: 'docs/readme.txt',
        })
      })
    })

    describe('wildcards', () => {
      it('matches wildcard at the end of the pathname', () => {
        let pattern = new RoutePattern('files/*')
        assert.deepEqual(pattern.match('https://example.com/files/readme.txt')?.params, {})
        assert.deepEqual(pattern.match('https://example.com/files/')?.params, {})
      })

      it('does not match wildcard at the end of the pathname when there is no trailing slash', () => {
        let pattern = new RoutePattern('files/*')
        assert.deepEqual(pattern.match('https://example.com/files'), null)
      })
    })

    describe('search params', () => {
      it('matches basic search param', () => {
        let pattern = new RoutePattern('search?q=test')
        assert.deepEqual(pattern.match('https://example.com/search?q=test')?.params, {})
      })

      it('returns null for missing search param', () => {
        let pattern = new RoutePattern('search?q=test')
        assert.deepEqual(pattern.match('https://example.com/search'), null)
      })

      it('returns null for wrong search param value', () => {
        let pattern = new RoutePattern('search?q=test')
        assert.deepEqual(pattern.match('https://example.com/search?q=other'), null)
      })

      it('matches with extra search params', () => {
        let pattern = new RoutePattern('search?q=test')
        assert.deepEqual(pattern.match('https://example.com/search?q=test&extra=value')?.params, {})
      })

      it('matches multiple search params', () => {
        let pattern = new RoutePattern('api?format=json&version=v1')
        assert.deepEqual(
          pattern.match('https://example.com/api?format=json&version=v1')?.params,
          {},
        )
      })

      it('returns null for missing one of multiple search params', () => {
        let pattern = new RoutePattern('api?format=json&version=v1')
        assert.deepEqual(pattern.match('https://example.com/api?format=json'), null)
      })

      it('matches search params in different order', () => {
        let pattern = new RoutePattern('api?format=json&version=v1')
        assert.deepEqual(
          pattern.match('https://example.com/api?version=v1&format=json')?.params,
          {},
        )
      })

      it('matches search param with empty value', () => {
        let pattern = new RoutePattern('search?q')
        assert.deepEqual(pattern.match('https://example.com/search?q')?.params, {})
      })

      it('matches search param with special characters', () => {
        let pattern = new RoutePattern('search?q=hello%20world')
        assert.deepEqual(pattern.match('https://example.com/search?q=hello%20world')?.params, {})
      })

      it('matches search param with + characters', () => {
        let pattern = new RoutePattern('search?q=hello+world')
        assert.deepEqual(pattern.match('https://example.com/search?q=hello%20world')?.params, {})
      })

      it('matches input with + characters', () => {
        let pattern = new RoutePattern('search?q=hello%20world')
        assert.deepEqual(pattern.match('https://example.com/search?q=hello+world')?.params, {})
      })

      it('matches search param with URL-encoded values', () => {
        let pattern = new RoutePattern('search?q=test%26more')
        assert.deepEqual(pattern.match('https://example.com/search?q=test%26more')?.params, {})
      })

      it('combines pathname params with search params', () => {
        let pattern = new RoutePattern('users/:id?format=json')
        assert.deepEqual(pattern.match('https://example.com/users/123?format=json')?.params, {
          id: '123',
        })
      })

      it('combines protocol, hostname, pathname, and search', () => {
        let pattern = new RoutePattern(
          ':protocol://:subdomain.example.com/api/:version?format=json',
        )
        assert.deepEqual(pattern.match('https://api.example.com/api/v1?format=json')?.params, {
          protocol: 'https',
          subdomain: 'api',
          version: 'v1',
        })
      })

      it('matches search params with repeated values', () => {
        let pattern = new RoutePattern('search?tags=javascript')
        assert.deepEqual(
          pattern.match('https://example.com/search?tags=javascript&tags=react')?.params,
          {},
        )
      })

      it('returns null when required search param value not found in repeated values', () => {
        let pattern = new RoutePattern('search?tags=python')
        assert.deepEqual(
          pattern.match('https://example.com/search?tags=javascript&tags=react'),
          null,
        )
      })

      it('handles search params with spaces in pattern', () => {
        let pattern = new RoutePattern('search?q=hello world')
        assert.deepEqual(pattern.match('https://example.com/search?q=hello world')?.params, {})
      })

      it('handles complex search param combinations', () => {
        let pattern = new RoutePattern('results?page=1&limit=10&sort=date')
        assert.deepEqual(
          pattern.match('https://example.com/results?page=1&limit=10&sort=date&extra=ignore')
            ?.params,
          {},
        )
      })
    })

    describe('ignoreCase', () => {
      it('stores the ignoreCase option', () => {
        let pattern = new RoutePattern('users/:id', { ignoreCase: true })
        assert.equal(pattern.ignoreCase, true)
      })

      it('matches case-insensitive pathnames', () => {
        let pattern = new RoutePattern('users/:id', { ignoreCase: true })
        assert.deepEqual(pattern.match('https://example.com/Users/123')?.params, { id: '123' })
      })

      it('does not match case-insensitive search params', () => {
        let pattern = new RoutePattern('search?q=hello world', { ignoreCase: true })
        assert.equal(pattern.match('https://example.com/search?q=Hello World'), null)
      })
    })
  })

  describe('test', () => {
    it('returns true if the URL matches the pattern', () => {
      let pattern = new RoutePattern('users/:id?format=json')
      assert.equal(pattern.test('https://example.com/users/123?format=json'), true)
    })
  })

  describe('toString', () => {
    it('returns the source pattern', () => {
      let pattern = new RoutePattern('users/:id?format=json')
      assert.equal(pattern.toString(), 'users/:id?format=json')
    })
  })
})
