import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parse, ParseError } from './parse.ts'
import type { Parse } from './parse.ts'
import type { Assert, IsEqual } from '../type-utils.d.ts'

describe('parse', () => {
  it('parses empty string', () => {
    assert.deepEqual(parse(''), {
      protocol: undefined,
      hostname: undefined,
      port: undefined,
      pathname: undefined,
      search: undefined,
    })
  })

  describe('pathname only patterns', () => {
    it('parses plain text', () => {
      assert.deepEqual(parse('hello'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [{ type: 'text', value: 'hello' }],
        search: undefined,
      })
    })

    it('parses text with spaces', () => {
      assert.deepEqual(parse('hello world'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [{ type: 'text', value: 'hello world' }],
        search: undefined,
      })
    })

    // variables

    it('parses named variable', () => {
      assert.deepEqual(parse(':id'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [{ type: 'variable', name: 'id' }],
        search: undefined,
      })
    })

    it('parses named variable with underscores', () => {
      assert.deepEqual(parse(':user_id'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [{ type: 'variable', name: 'user_id' }],
        search: undefined,
      })
    })

    it('parses named variable with dollar sign', () => {
      assert.deepEqual(parse(':$special'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [{ type: 'variable', name: '$special' }],
        search: undefined,
      })
    })

    it('parses text with variable', () => {
      assert.deepEqual(parse('users/:id'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [
          { type: 'text', value: 'users' },
          { type: 'separator' },
          { type: 'variable', name: 'id' },
        ],
        search: undefined,
      })
    })

    // wildcard

    it('parses named wildcard', () => {
      assert.deepEqual(parse('*files'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [{ type: 'wildcard', name: 'files' }],
        search: undefined,
      })
    })

    it('parses unnamed wildcard', () => {
      assert.deepEqual(parse('*'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [{ type: 'wildcard' }],
        search: undefined,
      })
    })

    // enum

    it('parses simple enum', () => {
      assert.deepEqual(parse('{a,b,c}'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [{ type: 'enum', members: ['a', 'b', 'c'] }],
        search: undefined,
      })
    })

    it('parses enum with spaces', () => {
      assert.deepEqual(parse('{hello,world}'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [{ type: 'enum', members: ['hello', 'world'] }],
        search: undefined,
      })
    })

    it('parses single member enum', () => {
      assert.deepEqual(parse('{only}'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [{ type: 'enum', members: ['only'] }],
        search: undefined,
      })
    })

    it('parses empty enum', () => {
      assert.deepEqual(parse('{}'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [{ type: 'enum', members: [''] }],
        search: undefined,
      })
    })

    // optional

    it('parses optional text', () => {
      assert.deepEqual(parse('(hello)'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [{ type: 'optional', tokens: [{ type: 'text', value: 'hello' }] }],
        search: undefined,
      })
    })

    it('parses optional variable', () => {
      assert.deepEqual(parse('(:id)'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [{ type: 'optional', tokens: [{ type: 'variable', name: 'id' }] }],
        search: undefined,
      })
    })

    it('parses optional with multiple tokens', () => {
      assert.deepEqual(parse('(users/:id)'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [
          {
            type: 'optional',
            tokens: [
              { type: 'text', value: 'users' },
              { type: 'separator' },
              { type: 'variable', name: 'id' },
            ],
          },
        ],
        search: undefined,
      })
    })

    it('parses text with optional', () => {
      assert.deepEqual(parse('api(/:version)'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [
          { type: 'text', value: 'api' },
          {
            type: 'optional',
            tokens: [{ type: 'separator' }, { type: 'variable', name: 'version' }],
          },
        ],
        search: undefined,
      })
    })

    // escaping

    it('parses escaped colon', () => {
      assert.deepEqual(parse('\\:'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [{ type: 'text', value: ':' }],
        search: undefined,
      })
    })

    it('parses escaped asterisk', () => {
      assert.deepEqual(parse('\\*'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [{ type: 'text', value: '*' }],
        search: undefined,
      })
    })

    it('parses escaped parenthesis', () => {
      assert.deepEqual(parse('\\('), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [{ type: 'text', value: '(' }],
        search: undefined,
      })
    })

    it('parses escaped brace', () => {
      assert.deepEqual(parse('\\{'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [{ type: 'text', value: '{' }],
        search: undefined,
      })
    })

    it('parses escaped backslash', () => {
      assert.deepEqual(parse('\\\\'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [{ type: 'text', value: '\\' }],
        search: undefined,
      })
    })

    it('parses text with escaped special chars', () => {
      assert.deepEqual(parse('hello\\:world\\*test'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [{ type: 'text', value: 'hello:world*test' }],
        search: undefined,
      })
    })

    // complex combinations

    it('parses complex pattern', () => {
      assert.deepEqual(parse('api/v:version/users/:id(*rest.:format)'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [
          { type: 'text', value: 'api' },
          { type: 'separator' },
          { type: 'text', value: 'v' },
          { type: 'variable', name: 'version' },
          { type: 'separator' },
          { type: 'text', value: 'users' },
          { type: 'separator' },
          { type: 'variable', name: 'id' },
          {
            type: 'optional',
            tokens: [
              { type: 'wildcard', name: 'rest' },
              { type: 'text', value: '.' },
              { type: 'variable', name: 'format' },
            ],
          },
        ],
        search: undefined,
      })
    })

    it('parses enum with optional', () => {
      assert.deepEqual(parse('{json,xml}(/:version)'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [
          { type: 'enum', members: ['json', 'xml'] },
          {
            type: 'optional',
            tokens: [{ type: 'separator' }, { type: 'variable', name: 'version' }],
          },
        ],
        search: undefined,
      })
    })

    it('parses pathname with leading slash', () => {
      assert.deepEqual(parse('/path/:id'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [
          { type: 'text', value: 'path' },
          { type: 'separator' },
          { type: 'variable', name: 'id' },
        ],
        search: undefined,
      })
    })

    it('parses pathname with leading slash and search', () => {
      assert.deepEqual(parse('/path/:id?q=1'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [
          { type: 'text', value: 'path' },
          { type: 'separator' },
          { type: 'variable', name: 'id' },
        ],
        search: new Map([
          [
            'q',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set(['1']),
            },
          ],
        ]),
      })
    })
  })

  describe('full URL patterns', () => {
    it('parses protocol only (without ://)', () => {
      assert.deepEqual(parse('https\\:'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [{ type: 'text', value: 'https:' }],
        search: undefined,
      })
    })

    it('parses protocol with variable (without ://)', () => {
      assert.deepEqual(parse(':protocol\\:'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [
          { type: 'variable', name: 'protocol' },
          { type: 'text', value: ':' },
        ],
        search: undefined,
      })
    })

    it('parses hostname only', () => {
      assert.deepEqual(parse('://example.com'), {
        protocol: undefined,
        hostname: [
          { type: 'text', value: 'example' },
          { type: 'separator' },
          { type: 'text', value: 'com' },
        ],
        port: undefined,
        pathname: undefined,
        search: undefined,
      })
    })

    it('parses hostname with variable', () => {
      assert.deepEqual(parse('://:subdomain.example.com'), {
        protocol: undefined,
        hostname: [
          { type: 'variable', name: 'subdomain' },
          { type: 'separator' },
          { type: 'text', value: 'example' },
          { type: 'separator' },
          { type: 'text', value: 'com' },
        ],
        port: undefined,
        pathname: undefined,
        search: undefined,
      })
    })

    it('parses protocol and hostname', () => {
      assert.deepEqual(parse('https://example.com'), {
        protocol: [{ type: 'text', value: 'https' }],
        hostname: [
          { type: 'text', value: 'example' },
          { type: 'separator' },
          { type: 'text', value: 'com' },
        ],
        port: undefined,
        pathname: undefined,
        search: undefined,
      })
    })

    it('parses hostname and port', () => {
      assert.deepEqual(parse('://example.com:8080'), {
        protocol: undefined,
        hostname: [
          { type: 'text', value: 'example' },
          { type: 'separator' },
          { type: 'text', value: 'com' },
        ],
        port: '8080',
        pathname: undefined,
        search: undefined,
      })
    })

    it('parses hostname with unnamed wildcard', () => {
      assert.deepEqual(parse('://*.example.com'), {
        protocol: undefined,
        hostname: [
          { type: 'wildcard' },
          { type: 'separator' },
          { type: 'text', value: 'example' },
          { type: 'separator' },
          { type: 'text', value: 'com' },
        ],
        port: undefined,
        pathname: undefined,
        search: undefined,
      })
    })

    it('parses hostname, port, and pathname', () => {
      assert.deepEqual(parse('://example.com:8080/api/:id'), {
        protocol: undefined,
        hostname: [
          { type: 'text', value: 'example' },
          { type: 'separator' },
          { type: 'text', value: 'com' },
        ],
        port: '8080',
        pathname: [
          { type: 'text', value: 'api' },
          { type: 'separator' },
          { type: 'variable', name: 'id' },
        ],
        search: undefined,
      })
    })

    it('parses protocol, hostname, and pathname', () => {
      assert.deepEqual(parse('https://example.com/api/:id'), {
        protocol: [{ type: 'text', value: 'https' }],
        hostname: [
          { type: 'text', value: 'example' },
          { type: 'separator' },
          { type: 'text', value: 'com' },
        ],
        port: undefined,
        pathname: [
          { type: 'text', value: 'api' },
          { type: 'separator' },
          { type: 'variable', name: 'id' },
        ],
        search: undefined,
      })
    })

    it('parses with search params', () => {
      assert.deepEqual(parse('search?q=:query'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [{ type: 'text', value: 'search' }],
        search: new Map([
          [
            'q',
            {
              allowBare: false,
              requireAssignment: true,
              requiredValues: new Set([':query']),
            },
          ],
        ]),
      })
    })

    it('parses complex full URL', () => {
      assert.deepEqual(
        parse(':protocol://:subdomain.example.com:8080/api/v:version/users/:id?format=json'),
        {
          protocol: [{ type: 'variable', name: 'protocol' }],
          hostname: [
            { type: 'variable', name: 'subdomain' },
            { type: 'separator' },
            { type: 'text', value: 'example' },
            { type: 'separator' },
            { type: 'text', value: 'com' },
          ],
          port: '8080',
          pathname: [
            { type: 'text', value: 'api' },
            { type: 'separator' },
            { type: 'text', value: 'v' },
            { type: 'variable', name: 'version' },
            { type: 'separator' },
            { type: 'text', value: 'users' },
            { type: 'separator' },
            { type: 'variable', name: 'id' },
          ],
          search: new Map([
            [
              'format',
              {
                allowBare: false,
                requireAssignment: true,
                requiredValues: new Set(['json']),
              },
            ],
          ]),
        },
      )
    })
  })

  describe('error reporting', () => {
    it('reports accurate positions in original source string', () => {
      // Test error in pathname part of a full URL pattern
      let source = 'https://example.com/users/:invalid)'
      try {
        parse(source)
        assert.fail('Expected ParseError to be thrown')
      } catch (error) {
        assert.ok(error instanceof ParseError)
        assert.equal(error.message, 'unmatched ) in pathname')
        assert.equal(error.position, 34) // Position of ')' in original string
        assert.equal(error.partName, 'pathname')
      }
    })

    it('reports accurate positions in hostname part', () => {
      let source = 'https://:.com/path'
      try {
        parse(source)
        assert.fail('Expected ParseError to be thrown')
      } catch (error) {
        assert.ok(error instanceof ParseError)
        assert.equal(error.message, 'missing variable name in hostname')
        assert.equal(error.position, 9) // Position after ':' in hostname
        assert.equal(error.partName, 'hostname')
      }
    })

    it('reports accurate positions in protocol part', () => {
      let source = 'http:://example.com/path'
      try {
        parse(source)
        assert.fail('Expected ParseError to be thrown')
      } catch (error) {
        assert.ok(error instanceof ParseError)
        assert.equal(error.message, 'missing variable name in protocol')
        assert.equal(error.position, 5) // Position after ':' with missing variable name
        assert.equal(error.partName, 'protocol')
      }
    })

    it('includes source context in error message', () => {
      let source = 'very-long-pathname-with-error/:invalid}'
      try {
        parse(source)
        assert.fail('Expected ParseError to be thrown')
      } catch (error) {
        assert.ok(error instanceof ParseError)
        assert.equal(error.message, 'unmatched } in pathname')
        assert.equal(error.source, source)
      }
    })

    it('reports missing variable name errors', () => {
      let source = '/:/blog'
      try {
        parse(source)
        assert.fail('Expected ParseError to be thrown')
      } catch (error) {
        assert.ok(error instanceof ParseError)
        assert.equal(error.message, 'missing variable name in pathname')
        assert.equal(error.position, 2)
        assert.equal(error.partName, 'pathname')
      }
    })

    it('reports unmatched opening brace errors', () => {
      let source = '{unclosed'
      try {
        parse(source)
        assert.fail('Expected ParseError to be thrown')
      } catch (error) {
        assert.ok(error instanceof ParseError)
        assert.equal(error.message, 'unmatched { in pathname')
        assert.equal(error.position, 0)
        assert.equal(error.partName, 'pathname')
      }
    })

    it('reports unmatched closing brace errors', () => {
      let source = 'closed}'
      try {
        parse(source)
        assert.fail('Expected ParseError to be thrown')
      } catch (error) {
        assert.ok(error instanceof ParseError)
        assert.equal(error.message, 'unmatched } in pathname')
        assert.equal(error.position, 6)
        assert.equal(error.partName, 'pathname')
      }
    })

    it('reports unmatched closing parenthesis errors', () => {
      let source = 'closed)'
      try {
        parse(source)
        assert.fail('Expected ParseError to be thrown')
      } catch (error) {
        assert.ok(error instanceof ParseError)
        assert.equal(error.message, 'unmatched ) in pathname')
        assert.equal(error.position, 6)
        assert.equal(error.partName, 'pathname')
      }
    })

    it('parses nested optionals', () => {
      assert.deepEqual(parse('(nested(test))'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [
          {
            type: 'optional',
            tokens: [
              { type: 'text', value: 'nested' },
              {
                type: 'optional',
                tokens: [{ type: 'text', value: 'test' }],
              },
            ],
          },
        ],
        search: undefined,
      })
    })

    it('parses nested optionals with variables and wildcards (named)', () => {
      assert.deepEqual(parse('files(/*path(.:ext))'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [
          { type: 'text', value: 'files' },
          {
            type: 'optional',
            tokens: [
              { type: 'separator' },
              { type: 'wildcard', name: 'path' },
              {
                type: 'optional',
                tokens: [
                  { type: 'text', value: '.' },
                  { type: 'variable', name: 'ext' },
                ],
              },
            ],
          },
        ],
        search: undefined,
      })
    })

    it('parses nested optionals with variables and wildcards (unnamed)', () => {
      assert.deepEqual(parse('files(/*(.:ext))'), {
        protocol: undefined,
        hostname: undefined,
        port: undefined,
        pathname: [
          { type: 'text', value: 'files' },
          {
            type: 'optional',
            tokens: [
              { type: 'separator' },
              { type: 'wildcard' },
              {
                type: 'optional',
                tokens: [
                  { type: 'text', value: '.' },
                  { type: 'variable', name: 'ext' },
                ],
              },
            ],
          },
        ],
        search: undefined,
      })
    })

    it('reports dangling escape errors', () => {
      let source = 'test\\'
      try {
        parse(source)
        assert.fail('Expected ParseError to be thrown')
      } catch (error) {
        assert.ok(error instanceof ParseError)
        assert.equal(error.message, 'dangling escape in pathname')
        assert.equal(error.position, 4)
        assert.equal(error.partName, 'pathname')
      }
    })

    it('reports unmatched opening parenthesis errors in nested optionals (missing closing ))', () => {
      let source = '(nested(test'
      try {
        parse(source)
        assert.fail('Expected ParseError to be thrown')
      } catch (error) {
        assert.ok(error instanceof ParseError)
        assert.equal(error.message, 'unmatched ( in pathname')
        assert.equal(error.position, 0)
        assert.equal(error.partName, 'pathname')
      }
    })

    it('reports unmatched closing parenthesis errors in nested optionals (missing opening ()', () => {
      let source = 'nested(test)))'
      try {
        parse(source)
        assert.fail('Expected ParseError to be thrown')
      } catch (error) {
        assert.ok(error instanceof ParseError)
        assert.equal(error.message, 'unmatched ) in pathname')
        assert.equal(error.position, 12)
        assert.equal(error.partName, 'pathname')
      }
    })
  })
})

export type Tests = [
  // empty string
  Assert<
    IsEqual<
      Parse<''>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: undefined
        search: undefined
      }
    >
  >,

  // pathname only patterns
  Assert<
    IsEqual<
      Parse<'hello'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'text'; value: 'hello' }]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'hello world'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'text'; value: 'hello world' }]
        search: undefined
      }
    >
  >,

  // variables
  Assert<
    IsEqual<
      Parse<':id'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'variable'; name: 'id' }]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<':user_id'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'variable'; name: 'user_id' }]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<':$special'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'variable'; name: '$special' }]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'users/:id'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [
          { type: 'text'; value: 'users' },
          { type: 'separator' },
          { type: 'variable'; name: 'id' },
        ]
        search: undefined
      }
    >
  >,

  // wildcard
  Assert<
    IsEqual<
      Parse<'*files'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'wildcard'; name: 'files' }]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'*'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'wildcard' }]
        search: undefined
      }
    >
  >,

  // enum
  Assert<
    IsEqual<
      Parse<'{a,b,c}'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'enum'; members: ['a', 'b', 'c'] }]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'{hello,world}'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'enum'; members: ['hello', 'world'] }]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'{only}'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'enum'; members: ['only'] }]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'{}'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'enum'; members: [''] }]
        search: undefined
      }
    >
  >,

  // optional
  Assert<
    IsEqual<
      Parse<'(hello)'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'optional'; tokens: [{ type: 'text'; value: 'hello' }] }]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'(:id)'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'optional'; tokens: [{ type: 'variable'; name: 'id' }] }]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'(users/:id)'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [
          {
            type: 'optional'
            tokens: [
              { type: 'text'; value: 'users' },
              { type: 'separator' },
              { type: 'variable'; name: 'id' },
            ]
          },
        ]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'api(/:version)'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [
          { type: 'text'; value: 'api' },
          {
            type: 'optional'
            tokens: [{ type: 'separator' }, { type: 'variable'; name: 'version' }]
          },
        ]
        search: undefined
      }
    >
  >,

  // escaping
  Assert<
    IsEqual<
      Parse<'\\:'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'text'; value: ':' }]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'\\*'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'text'; value: '*' }]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'\\('>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'text'; value: '(' }]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'\\{'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'text'; value: '{' }]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'\\\\'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'text'; value: '\\' }]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'hello\\:world\\*test'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'text'; value: 'hello:world*test' }]
        search: undefined
      }
    >
  >,

  // complex combinations
  Assert<
    IsEqual<
      Parse<'api/v:version/users/:id(*rest.:format)'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [
          { type: 'text'; value: 'api' },
          { type: 'separator' },
          { type: 'text'; value: 'v' },
          { type: 'variable'; name: 'version' },
          { type: 'separator' },
          { type: 'text'; value: 'users' },
          { type: 'separator' },
          { type: 'variable'; name: 'id' },
          {
            type: 'optional'
            tokens: [
              { type: 'wildcard'; name: 'rest' },
              { type: 'text'; value: '.' },
              { type: 'variable'; name: 'format' },
            ]
          },
        ]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'{json,xml}(/:version)'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [
          { type: 'enum'; members: ['json', 'xml'] },
          {
            type: 'optional'
            tokens: [{ type: 'separator' }, { type: 'variable'; name: 'version' }]
          },
        ]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'/path/:id'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [
          { type: 'text'; value: 'path' },
          { type: 'separator' },
          { type: 'variable'; name: 'id' },
        ]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'/path/:id?q=1'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [
          { type: 'text'; value: 'path' },
          { type: 'separator' },
          { type: 'variable'; name: 'id' },
        ]
        search: 'q=1'
      }
    >
  >,

  // full URL patterns
  Assert<
    IsEqual<
      Parse<'https\\:'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'text'; value: 'https:' }]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<':protocol\\:'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'variable'; name: 'protocol' }, { type: 'text'; value: ':' }]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'://example.com'>,
      {
        protocol: undefined
        hostname: [
          { type: 'text'; value: 'example' },
          { type: 'separator' },
          { type: 'text'; value: 'com' },
        ]
        port: undefined
        pathname: undefined
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'://:subdomain.example.com'>,
      {
        protocol: undefined
        hostname: [
          { type: 'variable'; name: 'subdomain' },
          { type: 'separator' },
          { type: 'text'; value: 'example' },
          { type: 'separator' },
          { type: 'text'; value: 'com' },
        ]
        port: undefined
        pathname: undefined
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'https://example.com'>,
      {
        protocol: [{ type: 'text'; value: 'https' }]
        hostname: [
          { type: 'text'; value: 'example' },
          { type: 'separator' },
          { type: 'text'; value: 'com' },
        ]
        port: undefined
        pathname: undefined
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'://example.com:8080'>,
      {
        protocol: undefined
        hostname: [
          { type: 'text'; value: 'example' },
          { type: 'separator' },
          { type: 'text'; value: 'com' },
        ]
        port: '8080'
        pathname: undefined
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'://*.example.com'>,
      {
        protocol: undefined
        hostname: [
          { type: 'wildcard' },
          { type: 'separator' },
          { type: 'text'; value: 'example' },
          { type: 'separator' },
          { type: 'text'; value: 'com' },
        ]
        port: undefined
        pathname: undefined
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'://example.com:8080/api/:id'>,
      {
        protocol: undefined
        hostname: [
          { type: 'text'; value: 'example' },
          { type: 'separator' },
          { type: 'text'; value: 'com' },
        ]
        port: '8080'
        pathname: [
          { type: 'text'; value: 'api' },
          { type: 'separator' },
          { type: 'variable'; name: 'id' },
        ]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'https://example.com/api/:id'>,
      {
        protocol: [{ type: 'text'; value: 'https' }]
        hostname: [
          { type: 'text'; value: 'example' },
          { type: 'separator' },
          { type: 'text'; value: 'com' },
        ]
        port: undefined
        pathname: [
          { type: 'text'; value: 'api' },
          { type: 'separator' },
          { type: 'variable'; name: 'id' },
        ]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'search?q=:query'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [{ type: 'text'; value: 'search' }]
        search: 'q=:query'
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<':protocol://:subdomain.example.com:8080/api/v:version/users/:id?format=json'>,
      {
        protocol: [{ type: 'variable'; name: 'protocol' }]
        hostname: [
          { type: 'variable'; name: 'subdomain' },
          { type: 'separator' },
          { type: 'text'; value: 'example' },
          { type: 'separator' },
          { type: 'text'; value: 'com' },
        ]
        port: '8080'
        pathname: [
          { type: 'text'; value: 'api' },
          { type: 'separator' },
          { type: 'text'; value: 'v' },
          { type: 'variable'; name: 'version' },
          { type: 'separator' },
          { type: 'text'; value: 'users' },
          { type: 'separator' },
          { type: 'variable'; name: 'id' },
        ]
        search: 'format=json'
      }
    >
  >,

  // nested optionals (successful parses)
  Assert<
    IsEqual<
      Parse<'(nested(test))'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [
          {
            type: 'optional'
            tokens: [
              { type: 'text'; value: 'nested' },
              { type: 'optional'; tokens: [{ type: 'text'; value: 'test' }] },
            ]
          },
        ]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'files(/*path(.:ext))'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [
          { type: 'text'; value: 'files' },
          {
            type: 'optional'
            tokens: [
              { type: 'separator' },
              { type: 'wildcard'; name: 'path' },
              {
                type: 'optional'
                tokens: [{ type: 'text'; value: '.' }, { type: 'variable'; name: 'ext' }]
              },
            ]
          },
        ]
        search: undefined
      }
    >
  >,
  Assert<
    IsEqual<
      Parse<'files(/*(.:ext))'>,
      {
        protocol: undefined
        hostname: undefined
        port: undefined
        pathname: [
          { type: 'text'; value: 'files' },
          {
            type: 'optional'
            tokens: [
              { type: 'separator' },
              { type: 'wildcard' },
              {
                type: 'optional'
                tokens: [{ type: 'text'; value: '.' }, { type: 'variable'; name: 'ext' }]
              },
            ]
          },
        ]
        search: undefined
      }
    >
  >,
]
