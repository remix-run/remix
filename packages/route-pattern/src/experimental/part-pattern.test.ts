import * as assert from 'node:assert/strict'
import test, { describe } from 'node:test'

import { PartPattern } from './part-pattern.ts'
import { ParseError } from './errors.ts'

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
    function assertVariants(source: string, variants: PartPattern['variants']) {
      assert.deepStrictEqual(PartPattern.parse(source).variants, variants)
    }

    test('produces all possible combinations of optionals', () => {
      assertVariants('a(:b)*c', [
        { key: 'a{*}', paramNames: ['c'] },
        { key: 'a{:}{*}', paramNames: ['b', 'c'] },
      ])
      assertVariants('a(:b)*c', [
        { key: 'a{*}', paramNames: ['c'] },
        { key: 'a{:}{*}', paramNames: ['b', 'c'] },
      ])
      assertVariants('a(:b)c(*d)e', [
        { key: 'ace', paramNames: [] },
        { key: 'ac{*}e', paramNames: ['d'] },
        { key: 'a{:}ce', paramNames: ['b'] },
        { key: 'a{:}c{*}e', paramNames: ['b', 'd'] },
      ])
      assertVariants('a(:b(*c):d)e', [
        { key: 'ae', paramNames: [] },
        { key: 'a{:}{:}e', paramNames: ['b', 'd'] },
        { key: 'a{:}{*}{:}e', paramNames: ['b', 'c', 'd'] },
      ])
      assertVariants('a(:b(*c):d)e(*f)g', [
        { key: 'aeg', paramNames: [] },
        { key: 'ae{*}g', paramNames: ['f'] },
        { key: 'a{:}{:}eg', paramNames: ['b', 'd'] },
        { key: 'a{:}{:}e{*}g', paramNames: ['b', 'd', 'f'] },
        { key: 'a{:}{*}{:}eg', paramNames: ['b', 'c', 'd'] },
        { key: 'a{:}{*}{:}e{*}g', paramNames: ['b', 'c', 'd', 'f'] },
      ])
    })
  })

  describe('toString', () => {
    test('stringifies combinations of text, variables, wildcards, optionals', () => {
      let examples = [
        'api/(v:major(.:minor)/)run',
        '*/node_modules/(*path/):package/dist/index.:ext',
      ]
      for (let source of examples) {
        assert.equal(PartPattern.parse(source).toString(), source)
      }
    })
  })
})
