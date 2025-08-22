import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { RoutePattern } from './route-pattern.ts'
import { createHrefBuilder } from './href.ts'

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
      let pathnameTests = [
        {
          name: 'matches plain text',
          pattern: 'users',
          input: 'https://example.com/users',
          expected: { params: {} },
        },
        {
          name: 'returns null for non-matching text',
          pattern: 'users',
          input: 'https://example.com/posts',
          expected: null,
        },
        {
          name: 'extracts named parameters',
          pattern: 'users/:id',
          input: 'https://example.com/users/123',
          expected: { params: { id: '123' } },
        },
        {
          name: 'extracts multiple parameters',
          pattern: 'users/:userId/posts/:postId',
          input: 'https://example.com/users/123/posts/456',
          expected: { params: { userId: '123', postId: '456' } },
        },
        {
          name: 'extracts named parameters - required',
          pattern: 'users/:id',
          input: 'https://example.com/users/123',
          expected: { params: { id: '123' } },
        },
        {
          name: 'extracts parameters with complex names',
          pattern: 'users/:user_id/posts/:$post',
          input: 'https://example.com/users/abc123/posts/def456',
          expected: { params: { user_id: 'abc123', $post: 'def456' } },
        },
        {
          name: 'extracts named wildcards',
          pattern: 'assets/*path',
          input: 'https://example.com/assets/images/logo.png',
          expected: { params: { path: 'images/logo.png' } },
        },
        {
          name: 'extracts named wildcards - required',
          pattern: 'assets/*path',
          input: 'https://example.com/assets/images/logo.png',
          expected: { params: { path: 'images/logo.png' } },
        },
        {
          name: 'matches optional sections when present',
          pattern: 'api(/:version)',
          input: 'https://example.com/api/v1',
          expected: { params: { version: 'v1' } },
        },
        {
          name: 'matches optional sections when absent',
          pattern: 'api(/:version)',
          input: 'https://example.com/api',
          expected: { params: { version: undefined } },
        },
        {
          name: 'matches complex optional patterns - with format',
          pattern: 'users/:id(.:format)',
          input: 'https://example.com/users/123.json',
          expected: { params: { id: '123.json', format: undefined } },
        },
        {
          name: 'matches complex optional patterns - without format',
          pattern: 'users/:id(.:format)',
          input: 'https://example.com/users/123',
          expected: { params: { id: '123', format: undefined } },
        },
        {
          name: 'handles mixed parameters and text',
          pattern: 'api/v:version/users/:id',
          input: 'https://example.com/api/v2/users/123',
          expected: { params: { version: '2', id: '123' } },
        },
        {
          name: 'handles escaped characters',
          pattern: 'users\\:test',
          input: 'https://example.com/users:test',
          expected: { params: {} },
        },
        {
          name: 'matches unnamed wildcard without capturing',
          pattern: 'files/*.jpg',
          input: 'https://example.com/files/logo.jpg',
          expected: { params: {} },
        },
        {
          name: 'unnamed wildcard non-match on extension',
          pattern: 'files/*.jpg',
          input: 'https://example.com/files/logo.png',
          expected: null,
        },
      ]

      pathnameTests.forEach(({ name, pattern, input, expected }) => {
        it(name, () => {
          let routePattern = new RoutePattern(pattern)
          assert.deepEqual(routePattern.match(input), expected)
        })
      })
    })

    describe('enums', () => {
      let enumTests = [
        {
          name: 'matches simple enum values',
          pattern: 'files/:name.{jpg,png,gif}',
          input: 'https://example.com/files/logo.png',
          expected: { params: { name: 'logo' } },
        },
        {
          name: 'returns null for non-matching enum values',
          pattern: 'files/:name.{jpg,png,gif}',
          input: 'https://example.com/files/logo.css',
          expected: null,
        },
        {
          name: 'matches enum at start of path',
          pattern: '{api,admin}/users',
          input: 'https://example.com/api/users',
          expected: { params: {} },
        },
        {
          name: 'matches enum in middle of path',
          pattern: 'assets/{images,styles}/file.ext',
          input: 'https://example.com/assets/styles/file.ext',
          expected: { params: {} },
        },
        {
          name: 'matches single-member enum',
          pattern: 'api/{v1}/users',
          input: 'https://example.com/api/v1/users',
          expected: { params: {} },
        },
        {
          name: 'combines enum with wildcards',
          pattern: 'assets/*path.{jpg,png,gif,svg}',
          input: 'https://example.com/assets/images/logos/remix.svg',
          expected: { params: { path: 'images/logos/remix' } },
        },
        {
          name: 'enum with optional sections',
          pattern: 'api/{json,xml}(/:version)',
          input: 'https://example.com/api/json/v2',
          expected: { params: { version: 'v2' } },
        },
        {
          name: 'enum with optional sections - absent',
          pattern: 'api/{json,xml}(/:version)',
          input: 'https://example.com/api/xml',
          expected: { params: { version: undefined } },
        },
      ]

      enumTests.forEach(({ name, pattern, input, expected }) => {
        it(name, () => {
          let routePattern = new RoutePattern(pattern)
          assert.deepEqual(routePattern.match(input), expected)
        })
      })
    })

    describe('multiple params in single segment', () => {
      let multiParamTests = [
        {
          name: 'extracts multiple params with dots',
          pattern: 'api/v:major.:minor',
          input: 'https://example.com/api/v2.1',
          expected: { params: { major: '2', minor: '1' } },
        },
        {
          name: 'extracts multiple params with dashes',
          pattern: 'blog/:year-:month-:day',
          input: 'https://example.com/blog/2024-01-15',
          expected: { params: { year: '2024', month: '01', day: '15' } },
        },
        {
          name: 'extracts params with mixed separators',
          pattern: 'users/@:username.:format',
          input: 'https://example.com/users/@sarah.json',
          expected: { params: { username: 'sarah', format: 'json' } },
        },
        {
          name: 'handles params with static prefix',
          pattern: 'users/@:id',
          input: 'https://example.com/users/@sarah',
          expected: { params: { id: 'sarah' } },
        },
        {
          name: 'handles params with static suffix',
          pattern: 'products/:name-shoes',
          input: 'https://example.com/products/tennis-shoes',
          expected: { params: { name: 'tennis' } },
        },
        {
          name: 'complex pattern with multiple params and text',
          pattern: 'api/v:major.:minor/users/:id/:action',
          input: 'https://example.com/api/v2.1/users/123/edit',
          expected: { params: { major: '2', minor: '1', id: '123', action: 'edit' } },
        },
      ]

      multiParamTests.forEach(({ name, pattern, input, expected }) => {
        it(name, () => {
          let routePattern = new RoutePattern(pattern)
          assert.deepEqual(routePattern.match(input), expected)
        })
      })
    })

    describe('complex combinations from README examples', () => {
      let complexTests = [
        {
          name: 'blog with date params and optional extension',
          pattern: 'blog/:year-:month-:day/:slug(.html)',
          input: 'https://remix.run/blog/2024-01-15/web-architecture',
          expected: { params: { year: '2024', month: '01', day: '15', slug: 'web-architecture' } },
        },
        {
          name: 'blog with date params and extension present',
          pattern: 'blog/:year-:month-:day/:slug(.html)',
          input: 'https://remix.run/blog/2024-01-15/web-architecture.html',
          expected: {
            params: { year: '2024', month: '01', day: '15', slug: 'web-architecture.html' },
          },
        },
        {
          name: 'API with optional versioning and format',
          pattern: 'api(/v:major.:minor)/users/:id(.json)',
          input: 'https://remix.run/api/users/sarah',
          expected: { params: { major: undefined, minor: undefined, id: 'sarah' } },
        },
        {
          name: 'API with versioning and format present',
          pattern: 'api(/v:major.:minor)/users/:id(.json)',
          input: 'https://remix.run/api/v2.1/users/sarah.json',
          expected: { params: { major: '2', minor: '1', id: 'sarah.json' } },
        },
        {
          name: 'complex wildcard with file and extension',
          pattern: '://app.unpkg.com/*path/dist/:file.mjs',
          input: 'https://app.unpkg.com/preact@10.26.9/files/dist/preact.mjs',
          expected: { params: { path: 'preact@10.26.9/files', file: 'preact' } },
        },
        {
          name: 'wildcard with static parts',
          pattern: 'assets/*version/favicon.ico',
          input: 'https://remix.run/assets/v2/favicon.ico',
          expected: { params: { version: 'v2' } },
        },
        {
          name: 'param with file extension enum',
          pattern: 'files/:filename.{jpg,png,gif}',
          input: 'https://remix.run/files/logo.png',
          expected: { params: { filename: 'logo' } },
        },
        {
          name: 'wildcard with file extension enum',
          pattern: 'assets/*path.{jpg,png,gif,svg}',
          input: 'https://remix.run/assets/images/logos/remix.svg',
          expected: { params: { path: 'images/logos/remix' } },
        },
        {
          name: 'wildcard with file extension enum - no match',
          pattern: 'assets/*path.{jpg,png,gif,svg}',
          input: 'https://remix.run/assets/styles/main.css',
          expected: null,
        },
      ]

      complexTests.forEach(({ name, pattern, input, expected }) => {
        it(name, () => {
          let routePattern = new RoutePattern(pattern)
          assert.deepEqual(routePattern.match(input), expected)
        })
      })
    })

    describe('full URL patterns', () => {
      let fullUrlTests = [
        {
          name: 'matches protocol patterns',
          pattern: 'https://example.com',
          input: 'https://example.com/',
          expected: { params: {} },
        },
        {
          name: 'extracts protocol parameters',
          pattern: ':protocol://example.com',
          input: 'https://example.com/',
          expected: { params: { protocol: 'https' } },
        },
        {
          name: 'matches hostname patterns',
          pattern: '://example.com',
          input: 'https://example.com/',
          expected: { params: {} },
        },
        {
          name: 'extracts hostname parameters',
          pattern: '://:subdomain.example.com',
          input: 'https://api.example.com/',
          expected: { params: { subdomain: 'api' } },
        },
        {
          name: 'matches complex hostname patterns',
          pattern: '://:tenant.app.example.com',
          input: 'https://acme.app.example.com/',
          expected: { params: { tenant: 'acme' } },
        },
        {
          name: 'combines protocol, hostname, and pathname',
          pattern: ':protocol://:subdomain.example.com/api/:version',
          input: 'https://api.example.com/api/v1',
          expected: { params: { protocol: 'https', subdomain: 'api', version: 'v1' } },
        },
        {
          name: 'matches when pattern specifies a fixed port',
          pattern: '://example.com:8080/api/:id',
          input: 'https://example.com:8080/api/123',
          expected: { params: { id: '123' } },
        },
        {
          name: 'returns null when port does not match fixed port',
          pattern: '://example.com:8080/api/:id',
          input: 'https://example.com:3000/api/123',
          expected: null,
        },
        {
          name: 'handles optional sections in full URLs',
          pattern: 'https://:tenant.example.com/users/:id',
          input: 'https://acme.example.com/users/123',
          expected: { params: { tenant: 'acme', id: '123' } },
        },
        {
          name: 'handles wildcards in hostnames',
          pattern: '://*host.example.com',
          input: 'https://api.v1.example.com/',
          expected: { params: { host: 'api.v1' } },
        },
        {
          name: 'handles unnamed wildcards in hostnames without capturing',
          pattern: '://*.example.com',
          input: 'https://api.v1.example.com/',
          expected: { params: {} },
        },
        {
          name: 'multi-tenant with optional admin path',
          pattern: '://:tenant.remix.run/(:admin/)users/:id',
          input: 'https://acme.remix.run/users/123',
          expected: { params: { tenant: 'acme', admin: undefined, id: '123' } },
        },
        {
          name: 'multi-tenant with admin path present',
          pattern: '://:tenant.remix.run/(:admin/)users/:id',
          input: 'https://acme.remix.run/admin/users/123',
          expected: { params: { tenant: 'acme', admin: 'admin', id: '123' } },
        },
      ]

      fullUrlTests.forEach(({ name, pattern, input, expected }) => {
        it(name, () => {
          let routePattern = new RoutePattern(pattern)
          assert.deepEqual(routePattern.match(input), expected)
        })
      })
    })

    describe('input types', () => {
      let inputTypeTests = [
        {
          name: 'accepts string URLs',
          pattern: 'users/:id',
          input: 'https://example.com/users/123',
          expected: { params: { id: '123' } },
        },
        {
          name: 'accepts URL objects',
          pattern: 'users/:id',
          input: new URL('https://example.com/users/123'),
          expected: { params: { id: '123' } },
        },
      ]

      inputTypeTests.forEach(({ name, pattern, input, expected }) => {
        it(name, () => {
          let routePattern = new RoutePattern(pattern)
          assert.deepEqual(routePattern.match(input), expected)
        })
      })
    })

    describe('edge cases', () => {
      let edgeCaseTests = [
        {
          name: 'handles empty patterns',
          pattern: '',
          input: 'https://example.com/',
          expected: { params: {} },
        },
        {
          name: 'handles root path',
          pattern: '/',
          input: 'https://example.com/',
          expected: null,
        },
        {
          name: 'handles patterns with no pathname',
          pattern: 'https://example.com',
          input: 'https://example.com/',
          expected: { params: {} },
        },
        {
          name: 'returns null for mismatched protocols',
          pattern: 'https://example.com',
          input: 'http://example.com/',
          expected: null,
        },
        {
          name: 'returns null for mismatched hostnames',
          pattern: '://example.com',
          input: 'https://other.com/',
          expected: null,
        },
        {
          name: 'returns null for mismatched paths',
          pattern: 'users/:id',
          input: 'https://example.com/posts/123',
          expected: null,
        },
        {
          name: 'handles special characters in URLs',
          pattern: 'search/:query',
          input: 'https://example.com/search/hello%20world',
          expected: { params: { query: 'hello%20world' } },
        },
        {
          name: 'handles wildcards that look like paths',
          pattern: 'proxy/*url',
          input: 'https://example.com/proxy/https://other.com/api',
          expected: { params: { url: 'https://other.com/api' } },
        },
      ]

      edgeCaseTests.forEach(({ name, pattern, input, expected }) => {
        it(name, () => {
          let routePattern = new RoutePattern(pattern)
          assert.deepEqual(routePattern.match(input), expected)
        })
      })
    })

    describe('variable constraints', () => {
      let constraintTests = [
        {
          name: 'variables do not match across path segments',
          pattern: 'users/:id/posts',
          input: 'https://example.com/users/123/456/posts',
          expected: null,
        },
        {
          name: 'hostname variables do not match across dots',
          pattern: '://:subdomain.example.com',
          input: 'https://api.v1.example.com/',
          expected: null,
        },
        {
          name: 'wildcards can match across segments',
          pattern: 'files/*path',
          input: 'https://example.com/files/docs/readme.txt',
          expected: { params: { path: 'docs/readme.txt' } },
        },
      ]

      constraintTests.forEach(({ name, pattern, input, expected }) => {
        it(name, () => {
          let routePattern = new RoutePattern(pattern)
          assert.deepEqual(routePattern.match(input), expected)
        })
      })
    })

    describe('search params', () => {
      let searchTests = [
        {
          name: 'matches basic search param',
          pattern: 'search?q=test',
          input: 'https://example.com/search?q=test',
          expected: { params: {} },
        },
        {
          name: 'returns null for missing search param',
          pattern: 'search?q=test',
          input: 'https://example.com/search',
          expected: null,
        },
        {
          name: 'returns null for wrong search param value',
          pattern: 'search?q=test',
          input: 'https://example.com/search?q=other',
          expected: null,
        },
        {
          name: 'matches with extra search params',
          pattern: 'search?q=test',
          input: 'https://example.com/search?q=test&extra=value',
          expected: { params: {} },
        },
        {
          name: 'matches multiple search params',
          pattern: 'api?format=json&version=v1',
          input: 'https://example.com/api?format=json&version=v1',
          expected: { params: {} },
        },
        {
          name: 'returns null for missing one of multiple search params',
          pattern: 'api?format=json&version=v1',
          input: 'https://example.com/api?format=json',
          expected: null,
        },
        {
          name: 'matches search params in different order',
          pattern: 'api?format=json&version=v1',
          input: 'https://example.com/api?version=v1&format=json',
          expected: { params: {} },
        },
        {
          name: 'matches search param with empty value',
          pattern: 'search?q',
          input: 'https://example.com/search?q',
          expected: { params: {} },
        },
        {
          name: 'matches search param with special characters',
          pattern: 'search?q=hello%20world',
          input: 'https://example.com/search?q=hello%20world',
          expected: { params: {} },
        },
        {
          name: 'matches search param with + characters',
          pattern: 'search?q=hello+world',
          input: 'https://example.com/search?q=hello%20world',
          expected: { params: {} },
        },
        {
          name: 'matches input with + characters',
          pattern: 'search?q=hello%20world',
          input: 'https://example.com/search?q=hello+world',
          expected: { params: {} },
        },
        {
          name: 'matches search param with URL-encoded values',
          pattern: 'search?q=test%26more',
          input: 'https://example.com/search?q=test%26more',
          expected: { params: {} },
        },
        {
          name: 'combines pathname params with search params',
          pattern: 'users/:id?format=json',
          input: 'https://example.com/users/123?format=json',
          expected: { params: { id: '123' } },
        },
        {
          name: 'combines protocol, hostname, pathname, and search',
          pattern: ':protocol://:subdomain.example.com/api/:version?format=json',
          input: 'https://api.example.com/api/v1?format=json',
          expected: { params: { protocol: 'https', subdomain: 'api', version: 'v1' } },
        },
        {
          name: 'matches search params with repeated values',
          pattern: 'search?tags=javascript',
          input: 'https://example.com/search?tags=javascript&tags=react',
          expected: { params: {} },
        },
        {
          name: 'returns null when required search param value not found in repeated values',
          pattern: 'search?tags=python',
          input: 'https://example.com/search?tags=javascript&tags=react',
          expected: null,
        },
        {
          name: 'handles search params with spaces in pattern',
          pattern: 'search?q=hello world',
          input: 'https://example.com/search?q=hello world',
          expected: { params: {} },
        },
        {
          name: 'handles complex search param combinations',
          pattern: 'results?page=1&limit=10&sort=date',
          input: 'https://example.com/results?page=1&limit=10&sort=date&extra=ignore',
          expected: { params: {} },
        },
      ]

      searchTests.forEach(({ name, pattern, input, expected }) => {
        it(name, () => {
          let routePattern = new RoutePattern(pattern)
          assert.deepEqual(routePattern.match(input), expected)
        })
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
