import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parse, ParseError } from './parse.ts'

describe('parse', () => {
  describe('pathname only patterns', () => {
    it('parses plain text', () => {
      assert.deepEqual(parse('hello'), { pathname: [{ type: 'text', value: 'hello' }] })
    })

    it('parses empty string', () => {
      assert.deepEqual(parse(''), {})
    })

    it('parses text with spaces', () => {
      assert.deepEqual(parse('hello world'), { pathname: [{ type: 'text', value: 'hello world' }] })
    })

    // variables

    it('parses named variable', () => {
      assert.deepEqual(parse(':id'), { pathname: [{ type: 'variable', name: 'id' }] })
    })

    it('parses named variable with underscores', () => {
      assert.deepEqual(parse(':user_id'), { pathname: [{ type: 'variable', name: 'user_id' }] })
    })

    it('parses named variable with dollar sign', () => {
      assert.deepEqual(parse(':$special'), { pathname: [{ type: 'variable', name: '$special' }] })
    })

    it('parses text with variable', () => {
      assert.deepEqual(parse('users/:id'), {
        pathname: [
          { type: 'text', value: 'users/' },
          { type: 'variable', name: 'id' },
        ],
      })
    })

    // wildcard

    it('parses named wildcard', () => {
      assert.deepEqual(parse('*files'), { pathname: [{ type: 'wildcard', name: 'files' }] })
    })

    it('parses unnamed wildcard', () => {
      assert.deepEqual(parse('*'), { pathname: [{ type: 'wildcard' }] })
    })

    // enum

    it('parses simple enum', () => {
      assert.deepEqual(parse('{a,b,c}'), { pathname: [{ type: 'enum', members: ['a', 'b', 'c'] }] })
    })

    it('parses enum with spaces', () => {
      assert.deepEqual(parse('{hello,world}'), {
        pathname: [{ type: 'enum', members: ['hello', 'world'] }],
      })
    })

    it('parses single member enum', () => {
      assert.deepEqual(parse('{only}'), { pathname: [{ type: 'enum', members: ['only'] }] })
    })

    it('parses empty enum', () => {
      assert.deepEqual(parse('{}'), { pathname: [{ type: 'enum', members: [''] }] })
    })

    // optional

    it('parses optional text', () => {
      assert.deepEqual(parse('(hello)'), {
        pathname: [{ type: 'optional', nodes: [{ type: 'text', value: 'hello' }] }],
      })
    })

    it('parses optional variable', () => {
      assert.deepEqual(parse('(:id)'), {
        pathname: [{ type: 'optional', nodes: [{ type: 'variable', name: 'id' }] }],
      })
    })

    it('parses optional with multiple nodes', () => {
      assert.deepEqual(parse('(users/:id)'), {
        pathname: [
          {
            type: 'optional',
            nodes: [
              { type: 'text', value: 'users/' },
              { type: 'variable', name: 'id' },
            ],
          },
        ],
      })
    })

    it('parses text with optional', () => {
      assert.deepEqual(parse('api(/:version)'), {
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
      })
    })

    // escaping

    it('parses escaped colon', () => {
      assert.deepEqual(parse('\\:'), { pathname: [{ type: 'text', value: ':' }] })
    })

    it('parses escaped asterisk', () => {
      assert.deepEqual(parse('\\*'), { pathname: [{ type: 'text', value: '*' }] })
    })

    it('parses escaped parenthesis', () => {
      assert.deepEqual(parse('\\('), { pathname: [{ type: 'text', value: '(' }] })
    })

    it('parses escaped brace', () => {
      assert.deepEqual(parse('\\{'), { pathname: [{ type: 'text', value: '{' }] })
    })

    it('parses escaped backslash', () => {
      assert.deepEqual(parse('\\\\'), { pathname: [{ type: 'text', value: '\\' }] })
    })

    it('parses text with escaped special chars', () => {
      assert.deepEqual(parse('hello\\:world\\*test'), {
        pathname: [{ type: 'text', value: 'hello:world*test' }],
      })
    })

    // complex combinations

    it('parses complex pattern', () => {
      assert.deepEqual(parse('api/v:version/users/:id(*rest.:format)'), {
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
      })
    })

    it('parses enum with optional', () => {
      assert.deepEqual(parse('{json,xml}(/:version)'), {
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
      })
    })
  })

  describe('full URL patterns', () => {
    it('parses protocol only (without ://)', () => {
      assert.deepEqual(parse('https\\:'), { pathname: [{ type: 'text', value: 'https:' }] })
    })

    it('parses protocol with variable (without ://)', () => {
      assert.deepEqual(parse(':protocol\\:'), {
        pathname: [
          { type: 'variable', name: 'protocol' },
          { type: 'text', value: ':' },
        ],
      })
    })

    it('parses hostname only', () => {
      assert.deepEqual(parse('://example.com'), {
        hostname: [{ type: 'text', value: 'example.com' }],
      })
    })

    it('parses hostname with variable', () => {
      assert.deepEqual(parse('://:subdomain.example.com'), {
        hostname: [
          { type: 'variable', name: 'subdomain' },
          { type: 'text', value: '.example.com' },
        ],
      })
    })

    it('parses protocol and hostname', () => {
      assert.deepEqual(parse('https://example.com'), {
        protocol: [{ type: 'text', value: 'https' }],
        hostname: [{ type: 'text', value: 'example.com' }],
      })
    })

    it('parses hostname and port', () => {
      assert.deepEqual(parse('://example.com:8080'), {
        hostname: [{ type: 'text', value: 'example.com' }],
        port: '8080',
      })
    })

    it('parses hostname with unnamed wildcard', () => {
      assert.deepEqual(parse('://*.example.com'), {
        hostname: [{ type: 'wildcard' }, { type: 'text', value: '.example.com' }],
      })
    })

    it('parses hostname, port, and pathname', () => {
      assert.deepEqual(parse('://example.com:8080/api/:id'), {
        hostname: [{ type: 'text', value: 'example.com' }],
        port: '8080',
        pathname: [
          { type: 'text', value: 'api/' },
          { type: 'variable', name: 'id' },
        ],
      })
    })

    it('parses protocol, hostname, and pathname', () => {
      assert.deepEqual(parse('https://example.com/api/:id'), {
        protocol: [{ type: 'text', value: 'https' }],
        hostname: [{ type: 'text', value: 'example.com' }],
        pathname: [
          { type: 'text', value: 'api/' },
          { type: 'variable', name: 'id' },
        ],
      })
    })

    it('parses with search params', () => {
      assert.deepEqual(parse('search?q=:query'), {
        pathname: [{ type: 'text', value: 'search' }],
        searchParams: new URLSearchParams('q=:query'),
      })
    })

    it('parses complex full URL', () => {
      assert.deepEqual(
        parse(':protocol://:subdomain.example.com:8080/api/v:version/users/:id?format=json'),
        {
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
          searchParams: new URLSearchParams('format=json'),
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
        pathname: [
          {
            type: 'optional',
            nodes: [
              { type: 'text', value: 'nested' },
              {
                type: 'optional',
                nodes: [{ type: 'text', value: 'test' }],
              },
            ],
          },
        ],
      })
    })

    it('parses nested optionals with variables and wildcards (named)', () => {
      assert.deepEqual(parse('files(/*path(.:ext))'), {
        pathname: [
          { type: 'text', value: 'files' },
          {
            type: 'optional',
            nodes: [
              { type: 'text', value: '/' },
              { type: 'wildcard', name: 'path' },
              {
                type: 'optional',
                nodes: [
                  { type: 'text', value: '.' },
                  { type: 'variable', name: 'ext' },
                ],
              },
            ],
          },
        ],
      })
    })

    it('parses nested optionals with variables and wildcards (unnamed)', () => {
      assert.deepEqual(parse('files(/*(.:ext))'), {
        pathname: [
          { type: 'text', value: 'files' },
          {
            type: 'optional',
            nodes: [
              { type: 'text', value: '/' },
              { type: 'wildcard' },
              {
                type: 'optional',
                nodes: [
                  { type: 'text', value: '.' },
                  { type: 'variable', name: 'ext' },
                ],
              },
            ],
          },
        ],
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
