import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ParseError } from './parse.ts'
import { PartPattern } from './part-pattern.ts'

describe('PartPattern', () => {
  describe('parse', () => {
    type AST = ConstructorParameters<typeof PartPattern>[0]
    function assertParse(source: string, ast: AST) {
      assert.deepEqual(
        PartPattern.parse(source, { type: 'pathname' }),
        new PartPattern(ast, { type: 'pathname' }),
      )
    }

    function assertParseError(source: string, type: ParseError['type'], index: number) {
      assert.throws(
        () => PartPattern.parse(source, { type: 'pathname' }),
        new ParseError(type, source, index),
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
  })

  describe('source', () => {
    function assertSource(expected: string) {
      let partPattern = PartPattern.parse(expected, { type: 'pathname' })
      assert.equal(partPattern.source, expected)
    }

    it('returns source representation of pattern', () => {
      assertSource('api/(v:major(.:minor)/)run')
      assertSource('*/node_modules/(*path/):package/dist/index.:ext')
    })
  })

  describe('match', () => {
    type MatchParam = { type: ':' | '*'; name: string; value: string; begin: number; end: number }
    function assertMatch(pattern: string, part: string, expected: Array<MatchParam>) {
      let result = PartPattern.parse(pattern, { type: 'pathname' }).match(part)
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

    it('matches pattern with case-sensitivity determined by ignoreCase option', () => {
      let pattern = PartPattern.parse('Posts/:id', { type: 'pathname' })
      assert.equal(pattern.match('posts/123'), null)
      assert.notEqual(pattern.match('Posts/123', { ignoreCase: false }), null)
      assert.notEqual(pattern.match('posts/123', { ignoreCase: true }), null)
    })
  })
})
