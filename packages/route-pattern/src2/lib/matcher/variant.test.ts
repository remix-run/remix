import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { parsePattern } from '../parse.ts'
import { generateVariants, type Variant } from './variant.ts'

describe('generateVariants', () => {
  it('expands missing protocol to http and https', () => {
    assertVariants('://example.com/posts', [
      { protocol: 'http', hostname: 'example.com', port: '', pathname: 'posts' },
      { protocol: 'https', hostname: 'example.com', port: '', pathname: 'posts' },
    ])
  })

  it('expands http(s) to http and https', () => {
    assertVariants('http(s)://example.com/posts', [
      { protocol: 'http' },
      { protocol: 'https' },
    ])
  })

  it('keeps explicit protocol as a single variant', () => {
    assertVariants('https://example.com/posts', [
      { protocol: 'https', hostname: 'example.com', pathname: 'posts' },
    ])
  })

  it('treats null hostname as any', () => {
    assertVariants('https:///posts', [{ hostname: 'any' }])
  })

  it('treats pathname-only pattern as any hostname for both protocols', () => {
    assertVariants('/posts/:id', [
      { protocol: 'http', hostname: 'any', pathname: 'posts/{:}' },
      { protocol: 'https', hostname: 'any', pathname: 'posts/{:}' },
    ])
  })

  it('fans param-free hostname into static variants per optional combo', () => {
    assertVariants('https://(www.)example.com/posts', [
      { hostname: 'example.com' },
      { hostname: 'www.example.com' },
    ])
  })

  it('keeps hostname with params as a single dynamic variant carrying a regexp', () => {
    let variants = generateVariants(parsePattern('https://:tenant.example.com/posts'))
    assert.equal(variants.length, 1)
    let host = variants[0].hostname
    assert.equal(host.type, 'dynamic')
    if (host.type !== 'dynamic') return
    assert.deepEqual(
      host.params.map((p) => ({ type: p.type, name: p.name })),
      [{ type: ':', name: 'tenant' }],
    )
    assert.equal(host.regexp.source, '^([^.]+?)\\.example\\.com$')
    assert.match('acme.example.com', host.regexp)
    assert.equal(host.regexp.exec('acme.example.com')?.[1], 'acme')
    assert.equal(host.regexp.exec('foo.bar.com'), null)
  })

  it('keeps port', () => {
    assertVariants('https://example.com:8080/posts', [{ port: '8080' }])
  })

  it('expands pathname optionals into one variant per combination', () => {
    // Filter to a single protocol so the cartesian-product doubling doesn't
    // obscure what we're checking — pathname optional expansion.
    let pathnames = (source: string) =>
      generateVariants(parsePattern(source))
        .filter((v) => v.protocol === 'http')
        .map((v) => v.pathname.map((s) => s.key).join('/'))

    assert.deepEqual(pathnames('a.:b.c'), ['a.{:}.c'])
    assert.deepEqual(pathnames('a(:b)*c'), ['a{*}', 'a{:}{*}'])
    assert.deepEqual(pathnames('a(:b)c(*d)e'), ['ace', 'ac{*}e', 'a{:}ce', 'a{:}c{*}e'])
    assert.deepEqual(pathnames('a(:b(*c):d)e'), ['ae', 'a{:}{:}e', 'a{:}{*}{:}e'])
    assert.deepEqual(pathnames('a(:b(*c):d)e(*f)g'), [
      'aeg',
      'ae{*}g',
      'a{:}{:}eg',
      'a{:}{:}e{*}g',
      'a{:}{*}{:}eg',
      'a{:}{*}{:}e{*}g',
    ])
  })

  it('takes cartesian product across protocol, hostname, and pathname', () => {
    assertVariants('://(www.)example.com/posts(/:id)', [
      { protocol: 'http', hostname: 'example.com', pathname: 'posts' },
      { protocol: 'http', hostname: 'example.com', pathname: 'posts/{:}' },
      { protocol: 'http', hostname: 'www.example.com', pathname: 'posts' },
      { protocol: 'http', hostname: 'www.example.com', pathname: 'posts/{:}' },
      { protocol: 'https', hostname: 'example.com', pathname: 'posts' },
      { protocol: 'https', hostname: 'example.com', pathname: 'posts/{:}' },
      { protocol: 'https', hostname: 'www.example.com', pathname: 'posts' },
      { protocol: 'https', hostname: 'www.example.com', pathname: 'posts/{:}' },
    ])
  })

  describe('pathname segments', () => {
    it('produces one segment per separator-delimited piece', () => {
      let [variant] = generateVariants(parsePattern('/users/:id/posts'))
      assert.deepEqual(
        variant.pathname.map((s) => ({ type: s.type, key: s.key })),
        [
          { type: 'static', key: 'users' },
          { type: 'variable', key: '{:}' },
          { type: 'static', key: 'posts' },
        ],
      )
    })

    it('absorbs separators into wildcard segments', () => {
      let [variant] = generateVariants(parsePattern('/files/*path/details'))
      assert.deepEqual(
        variant.pathname.map((s) => ({ type: s.type, key: s.key })),
        [
          { type: 'static', key: 'files' },
          { type: 'wildcard', key: '{*}/details' },
        ],
      )
    })

    it('compiles variable segments to a `[^/]+` regexp', () => {
      let [variant] = generateVariants(parsePattern('/users/:id'))
      let segment = variant.pathname[1]
      assert.equal(segment.type, 'variable')
      if (segment.type !== 'variable') return
      assert.equal(segment.regexp.source, '([^/]+)')
      assert.equal(segment.regexp.exec('42')?.[1], '42')
    })

    it('compiles wildcard segments to a `.*` regexp', () => {
      let [variant] = generateVariants(parsePattern('/files/*path'))
      let segment = variant.pathname[1]
      assert.equal(segment.type, 'wildcard')
      if (segment.type !== 'wildcard') return
      assert.equal(segment.regexp.source, '(.*)')
      assert.equal(segment.regexp.exec('docs/readme.md')?.[1], 'docs/readme.md')
    })
  })
})

type StringifiedVariant = {
  protocol: string
  hostname: string
  port: string
  pathname: string
}

/**
 * Assert that `generateVariants(parsePattern(source))` produces the expected
 * list, comparing only the keys present in each `expected` partial.
 *
 * Length of `actual` must match `expected`. For each variant, only the keys
 * the caller specified are checked — useful for focused assertions like
 * `[{ protocol: 'http' }, { protocol: 'https' }]`.
 */
function assertVariants(source: string, expected: ReadonlyArray<Partial<StringifiedVariant>>) {
  let actual = generateVariants(parsePattern(source)).map(stringifyVariant)
  assert.equal(actual.length, expected.length, `expected ${expected.length} variants, got ${actual.length}`)
  for (let i = 0; i < expected.length; i++) {
    let picked: Partial<StringifiedVariant> = {}
    for (let key of Object.keys(expected[i]) as Array<keyof StringifiedVariant>) {
      picked[key] = actual[i][key]
    }
    assert.deepEqual(picked, expected[i])
  }
}

function stringifyVariant(variant: Variant): StringifiedVariant {
  return {
    protocol: variant.protocol,
    hostname:
      variant.hostname.type === 'any'
        ? 'any'
        : variant.hostname.type === 'static'
          ? variant.hostname.value
          : variant.hostname.regexp.source,
    port: variant.port,
    pathname: variant.pathname.map((s) => s.key).join('/'),
  }
}

