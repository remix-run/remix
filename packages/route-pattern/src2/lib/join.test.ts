import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { joinPatterns } from './join.ts'
import { parsePattern } from './parse.ts'

describe('joinPatterns', () => {
  function assertJoin(a: string, b: string, expected: string) {
    assert.deepEqual(joinPatterns(parsePattern(a), parsePattern(b)), parsePattern(expected))
  }

  it('joins protocol', () => {
    assertJoin('http://', '://', 'http://')
    assertJoin('://', '://', '://')
    assertJoin('://', 'http://', 'http://')

    assertJoin('http://', '://example.com', 'http://example.com')
    assertJoin('://example.com', 'http://', 'http://example.com')

    assertJoin('http://', 'https://', 'https://')
    assertJoin('://example.com', 'https://', 'https://example.com')
    assertJoin('http://example.com', 'https://', 'https://example.com')

    assertJoin('http(s)://', 'https://', 'https://')
    assertJoin('https://', 'http(s)://', 'http(s)://')
  })

  it('joins hostname', () => {
    assertJoin('://example.com', '://*', '://example.com')
    assertJoin('://*', '://*', '://*')
    assertJoin('://*', '://example.com', '://example.com')

    assertJoin('://example.com', '://*host', '://*host')
    assertJoin('://*host', '://example.com', '://example.com')
    assertJoin('://*host', '://*other', '://*other')
    assertJoin('://*', '://*host', '://*host')

    assertJoin('://example.com', '://other.com', '://other.com')
    assertJoin('://', '://other.com', '://other.com')
    assertJoin('http://example.com', '://other.com', 'http://other.com')
    assertJoin('://example.com/pathname', '://other.com', '://other.com/pathname')
    assertJoin('/pathname', '://other.com', '://other.com/pathname')
  })

  it('joins port', () => {
    assertJoin('://:8000', '://', '://:8000')
    assertJoin('://', '://:8000', '://:8000')
    assertJoin('://:8000', '://:3000', '://:3000')
    assertJoin('://example.com', '://example.com:8000', '://example.com:8000')
    assertJoin('http://example.com:4321', '://example.com:8000', 'http://example.com:8000')
  })

  it('joins pathname', () => {
    assertJoin('', '', '')
    assertJoin('', 'b', 'b')
    assertJoin('a', '', 'a')

    assertJoin('a', 'b', 'a/b')
    assertJoin('a/', 'b', 'a/b')
    assertJoin('a', '/b', 'a/b')
    assertJoin('a/', '/b', 'a/b')

    assertJoin('(a)', '(b)', '(a)/(b)')
    assertJoin('(a/)', '(b)', '(a)/(b)')
    assertJoin('(a)', '(/b)', '(a)(/b)')
    assertJoin('(a/)', '(/b)', '(a)(/b)')
  })

  it('joins search', () => {
    assertJoin('path', '?a', 'path?a')
    assertJoin('?a', '?b=1', '?a&b=1')
    assertJoin('?a=1', '?b=2', '?a=1&b=2')
  })

  it('joins complex combinations', () => {
    assertJoin('http://example.com/a', 'http(s)://*host/b', 'http(s)://*host/a/b')
    assertJoin('http://example.com:8000/a', 'https:///b', 'https://example.com:8000/a/b')
    assertJoin('http://example.com:8000/a', '://other.com/b', 'http://other.com:8000/a/b')

    assertJoin(
      'https://api.example.com:8000/v1/:resource',
      '/users/(admin/)posts?filter&sort=asc',
      'https://api.example.com:8000/v1/:resource/users/(admin/)posts?filter=&sort=asc',
    )

    assertJoin(
      'http(s)://example.com/base',
      'http(s)://other.com/path',
      'http(s)://other.com/base/path',
    )

    assertJoin(
      'http://old.com:3000/keep/this',
      'https://new.com:8080',
      'https://new.com:8080/keep/this',
    )

    assertJoin(
      'users/:id?tab=profile',
      'posts/:postId?sort=recent',
      'users/:id/posts/:postId?tab=profile&sort=recent',
    )

    assertJoin(
      '://(staging.)example.com/api(/:version)',
      '://*/resources/:id(.json)',
      '://(staging.)example.com/api(/:version)/resources/:id(.json)',
    )
  })
})
