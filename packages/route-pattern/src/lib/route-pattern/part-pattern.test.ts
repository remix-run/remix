import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ParseError } from '../errors.ts'
import { PartPattern } from './part-pattern.ts'

describe('PartPattern', () => {
  describe('parse', () => {
    type AST = ConstructorParameters<typeof PartPattern>[0]
    function assertParse(source: string, ast: AST) {
      assert.deepEqual(
        PartPattern.parse(source, { type: 'pathname', ignoreCase: false }),
        new PartPattern(ast, { type: 'pathname', ignoreCase: false }),
      )
    }

    function assertParseError(source: string, type: ParseError['type'], index: number) {
      assert.throws(
        () => PartPattern.parse(source, { type: 'pathname', ignoreCase: false }),
        new ParseError(type, source, index),
      )
    }

    it('parses static text', () => {
      assertParse('abc', {
        tokens: [{ type: 'text', text: 'abc' }],
        paramNames: [],
        optionals: new Map(),
      })
    })

    it('parses a variable', () => {
      assertParse(':abc', {
        tokens: [{ type: ':', nameIndex: 0 }],
        paramNames: ['abc'],
        optionals: new Map(),
      })
      assertParse(':_hello_WORLD', {
        tokens: [{ type: ':', nameIndex: 0 }],
        paramNames: ['_hello_WORLD'],
        optionals: new Map(),
      })
      assertParse(':$_hello_WORLD$123$', {
        tokens: [{ type: ':', nameIndex: 0 }],
        paramNames: ['$_hello_WORLD$123$'],
        optionals: new Map(),
      })
    })

    it('parses a wildcard', () => {
      assertParse('*', {
        tokens: [{ type: '*', nameIndex: 0 }],
        paramNames: ['*'],
        optionals: new Map(),
      })
      assertParse('*abc', {
        tokens: [{ type: '*', nameIndex: 0 }],
        paramNames: ['abc'],
        optionals: new Map(),
      })
      assertParse('*_hello_WORLD', {
        tokens: [{ type: '*', nameIndex: 0 }],
        paramNames: ['_hello_WORLD'],
        optionals: new Map(),
      })
      assertParse('*$_hello_WORLD$123$', {
        tokens: [{ type: '*', nameIndex: 0 }],
        paramNames: ['$_hello_WORLD$123$'],
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
        paramNames: [],
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
        paramNames: [],
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
          { type: ':', nameIndex: 0 },
          { type: '(' },
          { type: 'text', text: '.' },
          { type: ':', nameIndex: 1 },
          { type: ')' },
          { type: 'separator' },
          { type: ')' },
          { type: 'text', text: 'run' },
        ],
        paramNames: ['major', 'minor'],
        optionals: new Map([
          [2, 10],
          [5, 8],
        ]),
      })

      assertParse('*/node_modules/(*path/):package/dist/index.:ext', {
        tokens: [
          { type: '*', nameIndex: 0 },
          { type: 'separator' },
          { type: 'text', text: 'node_modules' },
          { type: 'separator' },
          { type: '(' },
          { type: '*', nameIndex: 1 },
          { type: 'separator' },
          { type: ')' },
          { type: ':', nameIndex: 2 },
          { type: 'separator' },
          { type: 'text', text: 'dist' },
          { type: 'separator' },
          { type: 'text', text: 'index.' },
          { type: ':', nameIndex: 3 },
        ],
        paramNames: ['*', 'path', 'package', 'ext'],
        optionals: new Map([[4, 7]]),
      })
    })

    it('parses repeated param names', () => {
      assertParse(':id/:id', {
        tokens: [{ type: ':', nameIndex: 0 }, { type: 'separator' }, { type: ':', nameIndex: 1 }],
        paramNames: ['id', 'id'],
        optionals: new Map(),
      })
      assertParse('*id/*id', {
        tokens: [{ type: '*', nameIndex: 0 }, { type: 'separator' }, { type: '*', nameIndex: 1 }],
        paramNames: ['id', 'id'],
        optionals: new Map(),
      })
      assertParse('*/*', {
        tokens: [{ type: '*', nameIndex: 0 }, { type: 'separator' }, { type: '*', nameIndex: 1 }],
        paramNames: ['*', '*'],
        optionals: new Map(),
      })
      assertParse(':a/*a/:b/*b/:b/*a/:a', {
        tokens: [
          { type: ':', nameIndex: 0 },
          { type: 'separator' },
          { type: '*', nameIndex: 1 },
          { type: 'separator' },
          { type: ':', nameIndex: 2 },
          { type: 'separator' },
          { type: '*', nameIndex: 3 },
          { type: 'separator' },
          { type: ':', nameIndex: 4 },
          { type: 'separator' },
          { type: '*', nameIndex: 5 },
          { type: 'separator' },
          { type: ':', nameIndex: 6 },
        ],
        paramNames: ['a', 'a', 'b', 'b', 'b', 'a', 'a'],
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
  })

  describe('variants', () => {
    function assertVariants(source: string, expected: Array<string>) {
      let pattern = PartPattern.parse(source, { type: 'pathname', ignoreCase: false })
      let actual = pattern.variants.map((variant) => variant.toString())
      assert.deepEqual(actual, expected)
    }

    it('produces all possible combinations of optionals', () => {
      assertVariants('a.:b.c', ['a.{:b}.c'])
      assertVariants('a(:b)*c', ['a{*c}', 'a{:b}{*c}'])
      assertVariants('a(:b)c(*d)e', ['ace', 'ac{*d}e', 'a{:b}ce', 'a{:b}c{*d}e'])
      assertVariants('a(:b(*c):d)e', ['ae', 'a{:b}{:d}e', 'a{:b}{*c}{:d}e'])
      assertVariants('a(:b(*c):d)e(*f)g', [
        'aeg',
        'ae{*f}g',
        'a{:b}{:d}eg',
        'a{:b}{:d}e{*f}g',
        'a{:b}{*c}{:d}eg',
        'a{:b}{*c}{:d}e{*f}g',
      ])
    })
  })

  describe('source', () => {
    function assertSource(source: string) {
      assert.equal(
        PartPattern.parse(source, { type: 'pathname', ignoreCase: false }).source,
        source,
      )
    }

    it('returns source representation of pattern', () => {
      assertSource('api/(v:major(.:minor)/)run')
      assertSource('*/node_modules/(*path/):package/dist/index.:ext')
    })
  })

  describe('href', () => {
    function assertHref(
      pattern: string,
      params: Record<string, string | number> | undefined,
      expected: string,
    ) {
      let result = PartPattern.parse(pattern, { type: 'pathname', ignoreCase: false }).href(
        params ?? {},
      )
      assert.equal(result, expected)
    }

    function assertHrefNull(pattern: string, params: Record<string, string | number> | undefined) {
      let result = PartPattern.parse(pattern, { type: 'pathname', ignoreCase: false }).href(
        params ?? {},
      )
      assert.equal(result, null)
    }

    it('generates href for static text', () => {
      assertHref('/posts', undefined, '/posts')
      assertHref('/posts', { extra: 'ignored', foo: 'bar' }, '/posts')
    })

    it('generates href for optional text', () => {
      assertHref('hello(-world)', undefined, 'hello-world')
      assertHref('hello(-world)', { extra: 'ignored', foo: 'bar' }, 'hello-world')
    })

    it('generates href for variable', () => {
      assertHref('/posts/:id', { id: '123' }, '/posts/123')
      assertHref('/posts/:id', { id: 123 }, '/posts/123')
      assertHref('/posts/:id', { id: '123', extra: 'ignored', foo: 'bar' }, '/posts/123')
      assertHrefNull('/posts/:id', undefined)
    })

    it('generates href for optional variable', () => {
      assertHref('/posts(/:id)', undefined, '/posts')
      assertHref('/posts(/:id)', { id: '123' }, '/posts/123')
      assertHref('/posts(/:id)', { id: 123 }, '/posts/123')
      assertHref('/posts(/:id)', { id: '123', extra: 'ignored', foo: 'bar' }, '/posts/123')
    })

    it('generates href for wildcard', () => {
      assertHref('/files/*path', { path: 'a/b/c' }, '/files/a/b/c')
      assertHref('/files/*path', { path: 123 }, '/files/123')
      assertHref('/files/*path', { path: 'a/b/c', extra: 'ignored', foo: 'bar' }, '/files/a/b/c')
      assertHrefNull('/files/*path', undefined)
    })

    it('generates href for optional wildcard', () => {
      assertHref('/files/(*path)', undefined, '/files/')
      assertHref('/files/(*path)', { path: 'a/b/c' }, '/files/a/b/c')
      assertHref('/files/(*path)', { path: 123 }, '/files/123')
      assertHref('/files/(*path)', { path: 'a/b/c', extra: 'ignored', foo: 'bar' }, '/files/a/b/c')
    })

    it('generates href for nested optionals', () => {
      assertHref(':a/(:b/(:c/))', { a: 'x', b: 'some', c: 'thing' }, 'x/some/thing/')
      assertHref(
        ':a/(:b/(:c/))',
        { a: 'x', b: 'some', c: 'thing', extra: 'ignored', foo: 'bar' },
        'x/some/thing/',
      )
      assertHref(':a/(:b/(:c/))', { a: 'x', b: 'some' }, 'x/some/')
      assertHref(':a/(:b/(:c/))', { a: 'x', c: 'thing' }, 'x/')
    })

    it('generates href for independent params', () => {
      assertHref('(:a)(:b)', { a: 'x', b: 'y' }, 'xy')
      assertHref('(:a)(:b)', { a: 'x' }, 'x')
      assertHref('(:a)(:b)', { b: 'y' }, 'y')
      assertHref('(:a)(:b)', { a: 'x', b: 'y', extra: 'ignored', foo: 'bar' }, 'xy')
      assertHref('(:a)(:b)', undefined, '')
    })

    it('generates href for dependent params', () => {
      assertHref(':a(:b)-:a(:c)', { a: 1, b: 2 }, '12-1')
      assertHref(':a(:b)-:a(:c)', { a: 1, c: 3 }, '1-13')
      assertHref(':a(:b)-:a(:c)', { a: 1, b: 2, c: 3 }, '12-13')
      assertHrefNull(':a(:b)-:a(:c)', { b: 'thing' })
      assertHrefNull(':c(:b)-:a(:b)', { b: 'thing' })
    })
  })

  describe('match', () => {
    type MatchParam = { type: ':' | '*'; name: string; value: string; begin: number; end: number }
    function assertMatch(pattern: string, part: string, expected: Array<MatchParam>) {
      let result = PartPattern.parse(pattern, { type: 'pathname', ignoreCase: false }).match(part)
      assert.deepEqual(result, expected)
    }

    it('matches variable', () => {
      assertMatch('posts/:id', 'posts/123', [
        { type: ':', name: 'id', value: '123', begin: 6, end: 9 },
      ])
    })

    it('matches multiple variables', () => {
      assertMatch('posts/:id/comments/:commentId', 'posts/123/comments/456', [
        { type: ':', name: 'id', value: '123', begin: 6, end: 9 },
        { type: ':', name: 'commentId', value: '456', begin: 19, end: 22 },
      ])
    })

    it('matches multiple variables with repeated names', () => {
      assertMatch(':id/:id', '123/456', [
        { type: ':', name: 'id', value: '123', begin: 0, end: 3 },
        { type: ':', name: 'id', value: '456', begin: 4, end: 7 },
      ])
    })

    it('matches wildcard', () => {
      assertMatch('files/*path', 'files/a/b/c', [
        { type: '*', name: 'path', value: 'a/b/c', begin: 6, end: 11 },
      ])
    })

    it('matches multiple wildcards', () => {
      assertMatch('*prefix/middle/*suffix', 'a/b/middle/c/d', [
        { type: '*', name: 'prefix', value: 'a/b', begin: 0, end: 3 },
        { type: '*', name: 'suffix', value: 'c/d', begin: 11, end: 14 },
      ])
    })

    it('matches multiple wildcards with repeated names', () => {
      assertMatch('*path/*path', 'a/b/c/d', [
        { type: '*', name: 'path', value: 'a/b/c', begin: 0, end: 5 },
        { type: '*', name: 'path', value: 'd', begin: 6, end: 7 },
      ])
    })

    it('matches optional parameter when present', () => {
      assertMatch('api(/:version)', 'api/v1', [
        { type: ':', name: 'version', value: 'v1', begin: 4, end: 6 },
      ])
    })

    it('matches optional parameter when absent', () => {
      assertMatch('api(/:version)', 'api', [])
    })

    it('matches nested optional parameters when partially present', () => {
      assertMatch('api(/:major(/:minor))', 'api/v2', [
        { type: ':', name: 'major', value: 'v2', begin: 4, end: 6 },
      ])
    })

    it('matches nested optional parameters when all absent', () => {
      assertMatch('api(/:major(/:minor))', 'api', [])
    })
  })
})
