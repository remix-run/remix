import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import dedent from 'dedent'

import { RoutePatternParseError, parsePart, parsePattern } from './parse.ts'
import { serializePart } from './serialize.ts'
import type { PartPattern, RoutePattern } from './route-pattern.ts'

describe('RoutePatternParseError', () => {
  it('exposes type, source, and index properties', () => {
    let error = new RoutePatternParseError('unmatched (', 'foo(bar', 3)
    assert.equal(error.type, 'unmatched (')
    assert.equal(error.source, 'foo(bar')
    assert.equal(error.index, 3)
  })

  it('underlines the error indices', () => {
    let error = new RoutePatternParseError('unmatched (', 'api/(v:major', 4)
    assert.equal(
      error.toString(),
      dedent`
        RoutePatternParseError: unmatched (

        api/(v:major
            ^
      `,
    )
  })
})

describe('parsePart', () => {
  function assertParse(source: string, expected: Omit<PartPattern, 'type'>) {
    assert.deepEqual(parsePart(source, { type: 'pathname' }), { ...expected, type: 'pathname' })
  }

  function assertParseError(source: string, type: RoutePatternParseError['type'], index: number) {
    assert.throws(
      () => parsePart(source, { type: 'pathname' }),
      new RoutePatternParseError(type, source, index),
    )
  }

  it('parses static text', () => {
    assertParse('abc', {
      tokens: [{ type: 'text', text: 'abc' }],
      optionals: new Map(),
    })
  })

  it('parses a variable', () => {
    assertParse(':abc', {
      tokens: [{ type: ':', name: 'abc' }],
      optionals: new Map(),
    })
    assertParse(':_hello_WORLD', {
      tokens: [{ type: ':', name: '_hello_WORLD' }],
      optionals: new Map(),
    })
    assertParse(':$_hello_WORLD$123$', {
      tokens: [{ type: ':', name: '$_hello_WORLD$123$' }],
      optionals: new Map(),
    })
  })

  it('parses a wildcard', () => {
    assertParse('*', {
      tokens: [{ type: '*', name: '*' }],
      optionals: new Map(),
    })
    assertParse('*abc', {
      tokens: [{ type: '*', name: 'abc' }],
      optionals: new Map(),
    })
    assertParse('*_hello_WORLD', {
      tokens: [{ type: '*', name: '_hello_WORLD' }],
      optionals: new Map(),
    })
    assertParse('*$_hello_WORLD$123$', {
      tokens: [{ type: '*', name: '$_hello_WORLD$123$' }],
      optionals: new Map(),
    })
  })

  it('parses an optional', () => {
    assertParse('aa(bb)cc', {
      tokens: [
        { type: 'text', text: 'aa' },
        { type: '(' },
        { type: 'text', text: 'bb' },
        { type: ')' },
        { type: 'text', text: 'cc' },
      ],
      optionals: new Map([[1, 3]]),
    })
    assertParse('(aa(bb)cc)', {
      tokens: [
        { type: '(' },
        { type: 'text', text: 'aa' },
        { type: '(' },
        { type: 'text', text: 'bb' },
        { type: ')' },
        { type: 'text', text: 'cc' },
        { type: ')' },
      ],
      optionals: new Map([
        [0, 6],
        [2, 4],
      ]),
    })
  })

  it('parses combinations of text, variables, wildcards, optionals', () => {
    assertParse('api/(v:major(.:minor)/)run', {
      tokens: [
        { type: 'text', text: 'api' },
        { type: 'separator' },
        { type: '(' },
        { type: 'text', text: 'v' },
        { type: ':', name: 'major' },
        { type: '(' },
        { type: 'text', text: '.' },
        { type: ':', name: 'minor' },
        { type: ')' },
        { type: 'separator' },
        { type: ')' },
        { type: 'text', text: 'run' },
      ],
      optionals: new Map([
        [2, 10],
        [5, 8],
      ]),
    })

    assertParse('*/node_modules/(*path/):package/dist/index.:ext', {
      tokens: [
        { type: '*', name: '*' },
        { type: 'separator' },
        { type: 'text', text: 'node_modules' },
        { type: 'separator' },
        { type: '(' },
        { type: '*', name: 'path' },
        { type: 'separator' },
        { type: ')' },
        { type: ':', name: 'package' },
        { type: 'separator' },
        { type: 'text', text: 'dist' },
        { type: 'separator' },
        { type: 'text', text: 'index.' },
        { type: ':', name: 'ext' },
      ],
      optionals: new Map([[4, 7]]),
    })
  })

  it('parses repeated param names', () => {
    assertParse(':id/:id', {
      tokens: [{ type: ':', name: 'id' }, { type: 'separator' }, { type: ':', name: 'id' }],
      optionals: new Map(),
    })
    assertParse('*id/*id', {
      tokens: [{ type: '*', name: 'id' }, { type: 'separator' }, { type: '*', name: 'id' }],
      optionals: new Map(),
    })
    assertParse('*/*', {
      tokens: [{ type: '*', name: '*' }, { type: 'separator' }, { type: '*', name: '*' }],
      optionals: new Map(),
    })
    assertParse(':a/*a/:b/*b/:b/*a/:a', {
      tokens: [
        { type: ':', name: 'a' },
        { type: 'separator' },
        { type: '*', name: 'a' },
        { type: 'separator' },
        { type: ':', name: 'b' },
        { type: 'separator' },
        { type: '*', name: 'b' },
        { type: 'separator' },
        { type: ':', name: 'b' },
        { type: 'separator' },
        { type: '*', name: 'a' },
        { type: 'separator' },
        { type: ':', name: 'a' },
      ],
      optionals: new Map(),
    })
  })

  it("throws 'unmatched ('", () => {
    assertParseError('(', 'unmatched (', 0)
    assertParseError('(()', 'unmatched (', 0)
    assertParseError('()(', 'unmatched (', 2)
  })

  it("throws 'unmatched )'", () => {
    assertParseError(')', 'unmatched )', 0)
    assertParseError(')()', 'unmatched )', 0)
    assertParseError('())', 'unmatched )', 2)
  })

  it("throws 'missing variable name'", () => {
    assertParseError(':', 'missing variable name', 0)
    assertParseError('a:', 'missing variable name', 1)
    assertParseError('(a:)', 'missing variable name', 2)
    assertParseError(':(a)', 'missing variable name', 0)
    assertParseError(':123', 'missing variable name', 0)
    assertParseError('::', 'missing variable name', 0)
  })

  it("throws 'dangling escape'", () => {
    assertParseError('\\', 'dangling escape', 0)
  })

  it('uses / as separator for pathname type', () => {
    assert.deepEqual(parsePart('a/b/c', { type: 'pathname' }), {
      type: 'pathname',
      tokens: [
        { type: 'text', text: 'a' },
        { type: 'separator' },
        { type: 'text', text: 'b' },
        { type: 'separator' },
        { type: 'text', text: 'c' },
      ],
      optionals: new Map(),
    })
  })

  it('uses . as separator for hostname type', () => {
    assert.deepEqual(parsePart('a.b.c', { type: 'hostname' }), {
      type: 'hostname',
      tokens: [
        { type: 'text', text: 'a' },
        { type: 'separator' },
        { type: 'text', text: 'b' },
        { type: 'separator' },
        { type: 'text', text: 'c' },
      ],
      optionals: new Map(),
    })
  })
})

describe('parsePattern', () => {
  function assertParse(
    source: string,
    expected: {
      protocol?: RoutePattern['protocol']
      hostname?: string
      port?: string
      pathname?: string
      search?: Record<string, Array<string>>
    },
  ) {
    let pattern = parsePattern(source)
    let expectedSearch = new Map<string, Set<string>>()
    if (expected.search) {
      for (let name in expected.search) {
        let value = expected.search[name]
        expectedSearch.set(name, value.length === 0 ? new Set() : new Set(value))
      }
    }
    assert.deepEqual(
      {
        protocol: pattern.protocol,
        hostname: pattern.hostname ? serializePart(pattern.hostname) : null,
        port: pattern.port,
        pathname: serializePart(pattern.pathname),
        search: pattern.search,
      },
      {
        protocol: expected.protocol ?? null,
        hostname: expected.hostname ?? null,
        port: expected.port ?? null,
        pathname: expected.pathname ?? '',
        search: expectedSearch,
      },
    )
  }

  it('parses protocol', () => {
    assert.equal(parsePattern('http://').protocol, 'http')
    assert.equal(parsePattern('https://').protocol, 'https')
    assert.equal(parsePattern('http(s)://').protocol, 'http(s)')
  })

  it('parses hostname', () => {
    assertParse('://example.com', { hostname: 'example.com' })
  })

  it('parses port', () => {
    assertParse('://example.com:8000', { hostname: 'example.com', port: '8000' })
  })

  it('parses pathname', () => {
    assertParse('products/:id', { pathname: 'products/:id' })
  })

  it('parses search', () => {
    assertParse('?q', { search: { q: [] } })
    assertParse('?q=', { search: { q: [] } })
    assertParse('?q=1', { search: { q: ['1'] } })
  })

  it('decodes search params like URLSearchParams (spaces, +, reserved chars, UTF-8)', () => {
    assertParse('?q=a+b', { search: { q: ['a b'] } })
    assertParse('?q=a%20b', { search: { q: ['a b'] } })
    assertParse('?q=a%2Bb', { search: { q: ['a+b'] } })
    assertParse('?q=caf%C3%A9', { search: { q: ['café'] } })
  })

  it('parses protocol + hostname', () => {
    assertParse('https://example.com', { protocol: 'https', hostname: 'example.com' })
  })

  it('parses protocol + pathname', () => {
    assertParse('http:///dir/file', { protocol: 'http', pathname: 'dir/file' })
  })

  it('parses hostname + pathname', () => {
    assertParse('://example.com/about', { hostname: 'example.com', pathname: 'about' })
  })

  it('parses protocol + hostname + pathname', () => {
    assertParse('https://example.com/about', {
      protocol: 'https',
      hostname: 'example.com',
      pathname: 'about',
    })
  })

  it('parses protocol + hostname + search', () => {
    assertParse('https://example.com?q=1', {
      protocol: 'https',
      hostname: 'example.com',
      search: { q: ['1'] },
    })
  })

  it('parses protocol + pathname + search', () => {
    assertParse('http:///dir/file?q=1', {
      protocol: 'http',
      pathname: 'dir/file',
      search: { q: ['1'] },
    })
  })

  it('parses hostname + pathname + search', () => {
    assertParse('://example.com/about?q=1', {
      hostname: 'example.com',
      pathname: 'about',
      search: { q: ['1'] },
    })
  })

  it('parses protocol + hostname + pathname + search', () => {
    assertParse('https://example.com/about?q=1', {
      protocol: 'https',
      hostname: 'example.com',
      pathname: 'about',
      search: { q: ['1'] },
    })
  })

  it('parses search params into constraints grouped by param name', () => {
    assertParse('?q&q', { search: { q: [] } })
    assertParse('?q&q=', { search: { q: [] } })
    assertParse('?q&q=1', { search: { q: ['1'] } })
    assertParse('?q=&q=1', { search: { q: ['1'] } })
    assertParse('?q=1&q=2', { search: { q: ['1', '2'] } })
    assertParse('?q&q=&q=1&q=2', { search: { q: ['1', '2'] } })
  })

  it('throws on invalid protocol', () => {
    assert.throws(() => parsePattern('ftp://example.com'), {
      name: 'RoutePatternParseError',
      type: 'invalid protocol',
    })
    assert.throws(() => parsePattern('ws://example.com/path'), {
      name: 'RoutePatternParseError',
      type: 'invalid protocol',
    })
    assert.throws(() => parsePattern('httpx://example.com'), {
      name: 'RoutePatternParseError',
      type: 'invalid protocol',
    })
    assert.throws(() => parsePattern('http(s)x://example.com'), {
      name: 'RoutePatternParseError',
      type: 'invalid protocol',
    })
  })

  it('parses an empty pattern as empty pathname', () => {
    assertParse('', {})
    assertParse('/', {})
  })

  it('parses nameless hostname wildcard as null', () => {
    assertParse('://*', {})
  })
})
