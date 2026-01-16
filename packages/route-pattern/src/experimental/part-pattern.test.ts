import * as assert from 'node:assert/strict'
import test, { describe } from 'node:test'

import { PartPattern } from './part-pattern.ts'
import { ParseError } from './errors.ts'
import * as Variant from './variant.ts'

describe('PartPattern', () => {
  describe('parse', () => {
    type AST = ConstructorParameters<typeof PartPattern>[0]
    function assertParse(source: string, ast: AST) {
      assert.deepStrictEqual(PartPattern.parse(source), new PartPattern(ast))
    }

    function assertParseError(source: string, type: ParseError['type'], index: number) {
      assert.throws(() => PartPattern.parse(source), new ParseError(type, source, index))
    }

    test('parses static text', () => {
      assertParse('abc', {
        tokens: [{ type: 'text', text: 'abc' }],
        paramNames: [],
        optionals: new Map(),
      })
    })

    test('parses a variable', () => {
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

    test('parses a wildcard', () => {
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

    test('parses an optional', () => {
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

    test('parses combinations of text, variables, wildcards, optionals', () => {
      assertParse('api/(v:major(.:minor)/)run', {
        tokens: [
          { type: 'text', text: 'api/' },
          { type: '(' },
          { type: 'text', text: 'v' },
          { type: ':', nameIndex: 0 },
          { type: '(' },
          { type: 'text', text: '.' },
          { type: ':', nameIndex: 1 },
          { type: ')' },
          { type: 'text', text: '/' },
          { type: ')' },
          { type: 'text', text: 'run' },
        ],
        paramNames: ['major', 'minor'],
        optionals: new Map([
          [1, 9],
          [4, 7],
        ]),
      })

      assertParse('*/node_modules/(*path/):package/dist/index.:ext', {
        tokens: [
          { type: '*', nameIndex: 0 },
          { type: 'text', text: '/node_modules/' },
          { type: '(' },
          { type: '*', nameIndex: 1 },
          { type: 'text', text: '/' },
          { type: ')' },
          { type: ':', nameIndex: 2 },
          { type: 'text', text: '/dist/index.' },
          { type: ':', nameIndex: 3 },
        ],
        paramNames: ['*', 'path', 'package', 'ext'],
        optionals: new Map([[2, 5]]),
      })
    })

    test('parses repeated param names', () => {
      assertParse(':id/:id', {
        tokens: [
          { type: ':', nameIndex: 0 },
          { type: 'text', text: '/' },
          { type: ':', nameIndex: 1 },
        ],
        paramNames: ['id', 'id'],
        optionals: new Map(),
      })
      assertParse('*id/*id', {
        tokens: [
          { type: '*', nameIndex: 0 },
          { type: 'text', text: '/' },
          { type: '*', nameIndex: 1 },
        ],
        paramNames: ['id', 'id'],
        optionals: new Map(),
      })
      assertParse('*/*', {
        tokens: [
          { type: '*', nameIndex: 0 },
          { type: 'text', text: '/' },
          { type: '*', nameIndex: 1 },
        ],
        paramNames: ['*', '*'],
        optionals: new Map(),
      })
      assertParse(':a/*a/:b/*b/:b/*a/:a', {
        tokens: [
          { type: ':', nameIndex: 0 },
          { type: 'text', text: '/' },
          { type: '*', nameIndex: 1 },
          { type: 'text', text: '/' },
          { type: ':', nameIndex: 2 },
          { type: 'text', text: '/' },
          { type: '*', nameIndex: 3 },
          { type: 'text', text: '/' },
          { type: ':', nameIndex: 4 },
          { type: 'text', text: '/' },
          { type: '*', nameIndex: 5 },
          { type: 'text', text: '/' },
          { type: ':', nameIndex: 6 },
        ],
        paramNames: ['a', 'a', 'b', 'b', 'b', 'a', 'a'],
        optionals: new Map(),
      })
    })

    test("throws 'unmatched ('", () => {
      assertParseError('(', 'unmatched (', 0)
      assertParseError('(()', 'unmatched (', 0)
      assertParseError('()(', 'unmatched (', 2)
    })
    test("throws 'unmatched )'", () => {
      assertParseError(')', 'unmatched )', 0)
      assertParseError(')()', 'unmatched )', 0)
      assertParseError('())', 'unmatched )', 2)
    })
    test("throws 'missing variable name'", () => {
      assertParseError(':', 'missing variable name', 0)
      assertParseError('a:', 'missing variable name', 1)
      assertParseError('(a:)', 'missing variable name', 2)
      assertParseError(':(a)', 'missing variable name', 0)
      assertParseError(':123', 'missing variable name', 0)
      assertParseError('::', 'missing variable name', 0)
    })
    test("throws 'dangling escape'", () => {
      assertParseError('\\', 'dangling escape', 0)
    })
  })

  describe('variants', () => {
    function assertVariants(source: string, expected: Array<string>) {
      let pattern = PartPattern.parse(source)
      let actual = pattern.variants.map((v) => Variant.toString(v.tokens, pattern.paramNames))
      assert.deepStrictEqual(actual, expected)
    }

    test('produces all possible combinations of optionals', () => {
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

  describe('toString', () => {
    function assertToString(source: string) {
      assert.equal(PartPattern.parse(source).toString(), source)
    }

    test('stringifies combinations of text, variables, wildcards, optionals', () => {
      assertToString('api/(v:major(.:minor)/)run')
      assertToString('*/node_modules/(*path/):package/dist/index.:ext')
    })
  })

  describe('href', () => {
    function assertHref(
      pattern: string,
      params: Record<string, string | number> | undefined,
      expected: string,
    ) {
      let result = PartPattern.parse(pattern).href(params ?? {})
      assert.equal(result, expected)
    }

    function assertHrefNull(pattern: string, params: Record<string, string | number> | undefined) {
      let result = PartPattern.parse(pattern).href(params ?? {})
      assert.equal(result, null)
    }

    test('text', () => {
      assertHref('/posts', undefined, '/posts')
      assertHref('/posts', { extra: 'ignored', foo: 'bar' }, '/posts')
    })

    test('optional text', () => {
      assertHref('hello(-world)', undefined, 'hello-world')
      assertHref('hello(-world)', { extra: 'ignored', foo: 'bar' }, 'hello-world')
    })

    test('variable', () => {
      assertHref('/posts/:id', { id: '123' }, '/posts/123')
      assertHref('/posts/:id', { id: 123 }, '/posts/123')
      assertHref('/posts/:id', { id: '123', extra: 'ignored', foo: 'bar' }, '/posts/123')
      assertHrefNull('/posts/:id', undefined)
    })

    test('optional variable', () => {
      assertHref('/posts(/:id)', undefined, '/posts')
      assertHref('/posts(/:id)', { id: '123' }, '/posts/123')
      assertHref('/posts(/:id)', { id: 123 }, '/posts/123')
      assertHref('/posts(/:id)', { id: '123', extra: 'ignored', foo: 'bar' }, '/posts/123')
    })

    test('wildcard', () => {
      assertHref('/files/*path', { path: 'a/b/c' }, '/files/a/b/c')
      assertHref('/files/*path', { path: 123 }, '/files/123')
      assertHref('/files/*path', { path: 'a/b/c', extra: 'ignored', foo: 'bar' }, '/files/a/b/c')
      assertHrefNull('/files/*path', undefined)
    })

    test('optional wildcard', () => {
      assertHref('/files/(*path)', undefined, '/files/')
      assertHref('/files/(*path)', { path: 'a/b/c' }, '/files/a/b/c')
      assertHref('/files/(*path)', { path: 123 }, '/files/123')
      assertHref('/files/(*path)', { path: 'a/b/c', extra: 'ignored', foo: 'bar' }, '/files/a/b/c')
    })

    test('nested optionals', () => {
      assertHref(':a/(:b/(:c/))', { a: 'x', b: 'some', c: 'thing' }, 'x/some/thing/')
      assertHref(
        ':a/(:b/(:c/))',
        { a: 'x', b: 'some', c: 'thing', extra: 'ignored', foo: 'bar' },
        'x/some/thing/',
      )
      assertHref(':a/(:b/(:c/))', { a: 'x', b: 'some' }, 'x/some/')
      assertHref(':a/(:b/(:c/))', { a: 'x', c: 'thing' }, 'x/')
    })

    test('independent params', () => {
      assertHref('(:a)(:b)', { a: 'x', b: 'y' }, 'xy')
      assertHref('(:a)(:b)', { a: 'x' }, 'x')
      assertHref('(:a)(:b)', { b: 'y' }, 'y')
      assertHref('(:a)(:b)', { a: 'x', b: 'y', extra: 'ignored', foo: 'bar' }, 'xy')
      assertHref('(:a)(:b)', undefined, '')
    })

    test('dependent params', () => {
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
      let result = PartPattern.parse(pattern).match(part)
      assert.deepStrictEqual(result, expected)
    }

    test('variable', () => {
      assertMatch('posts/:id', 'posts/123', [
        { type: ':', name: 'id', value: '123', begin: 6, end: 9 },
      ])
    })

    test('multiple variables', () => {
      assertMatch('posts/:id/comments/:commentId', 'posts/123/comments/456', [
        { type: ':', name: 'id', value: '123', begin: 6, end: 9 },
        { type: ':', name: 'commentId', value: '456', begin: 19, end: 22 },
      ])
    })

    test('multiple variables with repeated names', () => {
      assertMatch(':id/:id', '123/456', [
        { type: ':', name: 'id', value: '123', begin: 0, end: 3 },
        { type: ':', name: 'id', value: '456', begin: 4, end: 7 },
      ])
    })

    test('wildcard', () => {
      assertMatch('files/*path', 'files/a/b/c', [
        { type: '*', name: 'path', value: 'a/b/c', begin: 6, end: 11 },
      ])
    })

    test('multiple wildcards', () => {
      assertMatch('*prefix/middle/*suffix', 'a/b/middle/c/d', [
        { type: '*', name: 'prefix', value: 'a/b', begin: 0, end: 3 },
        { type: '*', name: 'suffix', value: 'c/d', begin: 11, end: 14 },
      ])
    })

    test('multiple wildcards with repeated names', () => {
      assertMatch('*path/*path', 'a/b/c/d', [
        { type: '*', name: 'path', value: 'a/b/c', begin: 0, end: 5 },
        { type: '*', name: 'path', value: 'd', begin: 6, end: 7 },
      ])
    })
  })
})
