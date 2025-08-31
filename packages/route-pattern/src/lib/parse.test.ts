import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parse, ParseError } from './parse.ts'

describe('parse', () => {
  describe('pathname only patterns', () => {
    let testCases = [
      {
        name: 'plain text',
        input: 'hello',
        expected: {
          pathname: [{ type: 'text', value: 'hello' }],
        },
      },
      {
        name: 'empty string',
        input: '',
        expected: {},
      },
      {
        name: 'text with spaces',
        input: 'hello world',
        expected: {
          pathname: [{ type: 'text', value: 'hello world' }],
        },
      },

      // variable
      {
        name: 'named variable',
        input: ':id',
        expected: {
          pathname: [{ type: 'variable', name: 'id' }],
        },
      },
      {
        name: 'variable with underscores',
        input: ':user_id',
        expected: {
          pathname: [{ type: 'variable', name: 'user_id' }],
        },
      },
      {
        name: 'variable with dollar sign',
        input: ':$special',
        expected: {
          pathname: [{ type: 'variable', name: '$special' }],
        },
      },
      {
        name: 'text with variable',
        input: 'users/:id',
        expected: {
          pathname: [
            { type: 'text', value: 'users/' },
            { type: 'variable', name: 'id' },
          ],
        },
      },

      // wildcard
      {
        name: 'named wildcard',
        input: '*files',
        expected: {
          pathname: [{ type: 'wildcard', name: 'files' }],
        },
      },
      {
        name: 'unnamed wildcard',
        input: '*',
        expected: {
          pathname: [{ type: 'wildcard' }],
        },
      },
      {
        name: 'text with wildcard',
        input: 'assets/*files',
        expected: {
          pathname: [
            { type: 'text', value: 'assets/' },
            { type: 'wildcard', name: 'files' },
          ],
        },
      },
      {
        name: 'text with unnamed wildcard and suffix',
        input: 'files/*.jpg',
        expected: {
          pathname: [
            { type: 'text', value: 'files/' },
            { type: 'wildcard' },
            { type: 'text', value: '.jpg' },
          ],
        },
      },

      // enum
      {
        name: 'simple enum',
        input: '{a,b,c}',
        expected: {
          pathname: [{ type: 'enum', members: ['a', 'b', 'c'] }],
        },
      },
      {
        name: 'enum with spaces',
        input: '{hello,world}',
        expected: {
          pathname: [{ type: 'enum', members: ['hello', 'world'] }],
        },
      },
      {
        name: 'single member enum',
        input: '{only}',
        expected: {
          pathname: [{ type: 'enum', members: ['only'] }],
        },
      },
      {
        name: 'empty enum',
        input: '{}',
        expected: {
          pathname: [{ type: 'enum', members: [''] }],
        },
      },

      // optional
      {
        name: 'optional text',
        input: '(hello)',
        expected: {
          pathname: [{ type: 'optional', nodes: [{ type: 'text', value: 'hello' }] }],
        },
      },
      {
        name: 'optional variable',
        input: '(:id)',
        expected: {
          pathname: [{ type: 'optional', nodes: [{ type: 'variable', name: 'id' }] }],
        },
      },
      {
        name: 'optional with multiple nodes',
        input: '(users/:id)',
        expected: {
          pathname: [
            {
              type: 'optional',
              nodes: [
                { type: 'text', value: 'users/' },
                { type: 'variable', name: 'id' },
              ],
            },
          ],
        },
      },
      {
        name: 'text with optional',
        input: 'api(/:version)',
        expected: {
          pathname: [
            { type: 'text', value: 'api' },
            {
              type: 'optional',
              nodes: [
                { type: 'text', value: '/' },
                { type: 'variable', name: 'version' },
              ],
            },
          ],
        },
      },

      // escaping
      {
        name: 'escaped colon',
        input: '\\:',
        expected: {
          pathname: [{ type: 'text', value: ':' }],
        },
      },
      {
        name: 'escaped asterisk',
        input: '\\*',
        expected: {
          pathname: [{ type: 'text', value: '*' }],
        },
      },
      {
        name: 'escaped parenthesis',
        input: '\\(',
        expected: {
          pathname: [{ type: 'text', value: '(' }],
        },
      },
      {
        name: 'escaped brace',
        input: '\\{',
        expected: {
          pathname: [{ type: 'text', value: '{' }],
        },
      },
      {
        name: 'escaped backslash',
        input: '\\\\',
        expected: {
          pathname: [{ type: 'text', value: '\\' }],
        },
      },
      {
        name: 'text with escaped special chars',
        input: 'hello\\:world\\*test',
        expected: {
          pathname: [{ type: 'text', value: 'hello:world*test' }],
        },
      },

      // Complex combinations
      {
        name: 'complex pattern',
        input: 'api/v:version/users/:id(*rest.:format)',
        expected: {
          pathname: [
            { type: 'text', value: 'api/v' },
            { type: 'variable', name: 'version' },
            { type: 'text', value: '/users/' },
            { type: 'variable', name: 'id' },
            {
              type: 'optional',
              nodes: [
                { type: 'wildcard', name: 'rest' },
                { type: 'text', value: '.' },
                { type: 'variable', name: 'format' },
              ],
            },
          ],
        },
      },
      {
        name: 'enum with optional',
        input: '{json,xml}(/:version)',
        expected: {
          pathname: [
            { type: 'enum', members: ['json', 'xml'] },
            {
              type: 'optional',
              nodes: [
                { type: 'text', value: '/' },
                { type: 'variable', name: 'version' },
              ],
            },
          ],
        },
      },
    ]

    testCases.forEach(({ name, input, expected }) => {
      it(name, () => {
        let result = parse(input)
        assert.deepEqual(result, expected)
      })
    })
  })

  describe('full URL patterns', () => {
    let testCases = [
      {
        name: 'protocol only (without ://)',
        input: 'https\\:',
        expected: {
          pathname: [{ type: 'text', value: 'https:' }],
        },
      },
      {
        name: 'protocol with variable (without ://)',
        input: ':protocol\\:',
        expected: {
          pathname: [
            { type: 'variable', name: 'protocol' },
            { type: 'text', value: ':' },
          ],
        },
      },
      {
        name: 'hostname only',
        input: '://example.com',
        expected: {
          hostname: [{ type: 'text', value: 'example.com' }],
        },
      },
      {
        name: 'hostname with variable',
        input: '://:subdomain.example.com',
        expected: {
          hostname: [
            { type: 'variable', name: 'subdomain' },
            { type: 'text', value: '.example.com' },
          ],
        },
      },
      {
        name: 'protocol and hostname',
        input: 'https://example.com',
        expected: {
          protocol: [{ type: 'text', value: 'https' }],
          hostname: [{ type: 'text', value: 'example.com' }],
        },
      },
      {
        name: 'hostname and port',
        input: '://example.com:8080',
        expected: {
          hostname: [{ type: 'text', value: 'example.com' }],
          port: '8080',
        },
      },
      {
        name: 'hostname with unnamed wildcard',
        input: '://*.example.com',
        expected: {
          hostname: [{ type: 'wildcard' }, { type: 'text', value: '.example.com' }],
        },
      },
      {
        name: 'hostname, port, and pathname',
        input: '://example.com:8080/api/:id',
        expected: {
          hostname: [{ type: 'text', value: 'example.com' }],
          port: '8080',
          pathname: [
            { type: 'text', value: 'api/' },
            { type: 'variable', name: 'id' },
          ],
        },
      },
      {
        name: 'protocol, hostname, and pathname',
        input: 'https://example.com/api/:id',
        expected: {
          protocol: [{ type: 'text', value: 'https' }],
          hostname: [{ type: 'text', value: 'example.com' }],
          pathname: [
            { type: 'text', value: 'api/' },
            { type: 'variable', name: 'id' },
          ],
        },
      },
      {
        name: 'with search params',
        input: 'search?q=:query',
        expected: {
          pathname: [{ type: 'text', value: 'search' }],
          search: 'q=:query',
        },
      },
      {
        name: 'complex full URL',
        input: ':protocol://:subdomain.example.com:8080/api/v:version/users/:id?format=json',
        expected: {
          protocol: [{ type: 'variable', name: 'protocol' }],
          hostname: [
            { type: 'variable', name: 'subdomain' },
            { type: 'text', value: '.example.com' },
          ],
          port: '8080',
          pathname: [
            { type: 'text', value: 'api/v' },
            { type: 'variable', name: 'version' },
            { type: 'text', value: '/users/' },
            { type: 'variable', name: 'id' },
          ],
          search: 'format=json',
        },
      },
    ]

    testCases.forEach(({ name, input, expected }) => {
      it(name, () => {
        let result = parse(input)
        assert.deepEqual(result, expected)
      })
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

    it('reports invalid nested parenthesis errors', () => {
      let source = '(nested(test))'
      try {
        parse(source)
        assert.fail('Expected ParseError to be thrown')
      } catch (error) {
        assert.ok(error instanceof ParseError)
        assert.equal(error.message, 'invalid nested ( in pathname')
        assert.equal(error.position, 7)
        assert.equal(error.partName, 'pathname')
      }
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
  })
})
