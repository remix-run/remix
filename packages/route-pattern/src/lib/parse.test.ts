import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parse } from './parse.ts';

describe('parse', () => {
  describe('pathname only patterns', () => {
    const testCases = [
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

      // param
      {
        name: 'named parameter',
        input: ':id',
        expected: {
          pathname: [{ type: 'param', name: 'id' }],
        },
      },
      {
        name: 'parameter without name',
        input: ':',
        expected: {
          pathname: [{ type: 'param' }],
        },
      },
      {
        name: 'parameter with underscores',
        input: ':user_id',
        expected: {
          pathname: [{ type: 'param', name: 'user_id' }],
        },
      },
      {
        name: 'parameter with dollar sign',
        input: ':$special',
        expected: {
          pathname: [{ type: 'param', name: '$special' }],
        },
      },
      {
        name: 'text with parameter',
        input: 'users/:id',
        expected: {
          pathname: [
            { type: 'text', value: 'users/' },
            { type: 'param', name: 'id' },
          ],
        },
      },

      // glob
      {
        name: 'named glob',
        input: '*files',
        expected: {
          pathname: [{ type: 'glob', name: 'files' }],
        },
      },
      {
        name: 'glob without name',
        input: '*',
        expected: {
          pathname: [{ type: 'glob' }],
        },
      },
      {
        name: 'text with glob',
        input: 'assets/*files',
        expected: {
          pathname: [
            { type: 'text', value: 'assets/' },
            { type: 'glob', name: 'files' },
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
        name: 'optional parameter',
        input: '(:id)',
        expected: {
          pathname: [{ type: 'optional', nodes: [{ type: 'param', name: 'id' }] }],
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
                { type: 'param', name: 'id' },
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
                { type: 'param', name: 'version' },
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
            { type: 'param', name: 'version' },
            { type: 'text', value: '/users/' },
            { type: 'param', name: 'id' },
            {
              type: 'optional',
              nodes: [
                { type: 'glob' },
                { type: 'text', value: '.' },
                { type: 'param', name: 'format' },
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
                { type: 'param', name: 'version' },
              ],
            },
          ],
        },
      },
    ];

    testCases.forEach(({ name, input, expected }) => {
      it(name, () => {
        const result = parse(input);
        assert.deepStrictEqual(result, expected);
      });
    });
  });

  describe('full URL patterns', () => {
    const testCases = [
      {
        name: 'protocol only (without ://)',
        input: 'https:',
        expected: {
          pathname: [{ type: 'text', value: 'https' }, { type: 'param' }],
        },
      },
      {
        name: 'protocol with param (without ://)',
        input: ':protocol:',
        expected: {
          pathname: [{ type: 'param', name: 'protocol' }, { type: 'param' }],
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
        name: 'hostname with param',
        input: '://:subdomain.example.com',
        expected: {
          hostname: [
            { type: 'param', name: 'subdomain' },
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
            { type: 'param', name: 'id' },
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
          protocol: [{ type: 'param', name: 'protocol' }],
          hostname: [
            { type: 'param', name: 'subdomain' },
            { type: 'text', value: '.example.com' },
          ],
          pathname: [
            { type: 'text', value: 'api/v' },
            { type: 'param', name: 'version' },
            { type: 'text', value: '/users/' },
            { type: 'param', name: 'id' },
          ],
          search: new URLSearchParams('format=json'),
        },
      },
    ];

    testCases.forEach(({ name, input, expected }) => {
      it(name, () => {
        const result = parse(input);
        assert.deepStrictEqual(result, expected);
      });
    });
  });

  describe('error cases', () => {
    const errorCases = [
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
    ];

    errorCases.forEach(({ name, input, expectedError }) => {
      it(name, () => {
        assert.throws(() => parse(input), {
          message: expectedError,
        });
      });
    });
  });
});
