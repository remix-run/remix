import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parse } from './parse.ts'

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
        name: 'variable without name',
        input: ':',
        expected: {
          pathname: [{ type: 'variable' }],
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
        name: 'wildcard without name',
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
        input: 'api/v:version/users/:id(*.:format)',
        expected: {
          pathname: [
            { type: 'text', value: 'api/v' },
            { type: 'variable', name: 'version' },
            { type: 'text', value: '/users/' },
            { type: 'variable', name: 'id' },
            {
              type: 'optional',
              nodes: [
                { type: 'wildcard' },
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
        input: 'https:',
        expected: {
          pathname: [{ type: 'text', value: 'https' }, { type: 'variable' }],
        },
      },
      {
        name: 'protocol with variable (without ://)',
        input: ':protocol:',
        expected: {
          pathname: [{ type: 'variable', name: 'protocol' }, { type: 'variable' }],
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
          search: new URLSearchParams('q=:query'),
        },
      },
      {
        name: 'complex full URL',
        input: ':protocol://:subdomain.example.com/api/v:version/users/:id?format=json',
        expected: {
          protocol: [{ type: 'variable', name: 'protocol' }],
          hostname: [
            { type: 'variable', name: 'subdomain' },
            { type: 'text', value: '.example.com' },
          ],
          pathname: [
            { type: 'text', value: 'api/v' },
            { type: 'variable', name: 'version' },
            { type: 'text', value: '/users/' },
            { type: 'variable', name: 'id' },
          ],
          search: new URLSearchParams('format=json'),
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

  describe('error cases', () => {
    let errorCases = [
      {
        name: 'unmatched opening brace',
        input: '{unclosed',
        expectedError: 'unmatched { at 0',
      },
      {
        name: 'unmatched closing brace',
        input: 'closed}',
        expectedError: 'unmatched } at 6',
      },
      {
        name: 'unmatched closing parenthesis',
        input: 'closed)',
        expectedError: 'unmatched ) at 6',
      },
      {
        name: 'nested opening parenthesis',
        input: '(nested(test))',
        expectedError: 'nested ( at 0 7',
      },
      {
        name: 'dangling escape',
        input: 'test\\',
        expectedError: 'dangling escape at 4',
      },
    ]

    errorCases.forEach(({ name, input, expectedError }) => {
      it(name, () => {
        assert.throws(() => parse(input), {
          message: expectedError,
        })
      })
    })
  })
})
