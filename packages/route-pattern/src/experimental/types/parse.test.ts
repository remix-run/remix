import type { Assert, IsEqual } from './utils.ts'
import type { Parse } from './parse.ts'

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
  Assert<
    IsEqual<
      Parse<'users/:id' | 'api/(v:major(.:minor))'>,
      | {
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
      | {
          protocol: undefined
          hostname: undefined
          port: undefined
          pathname: [
            { type: 'text'; value: 'api' },
            { type: 'separator' },
            {
              type: 'optional'
              tokens: [
                { type: 'text'; value: 'v' },
                { type: 'variable'; name: 'major' },
                {
                  type: 'optional'
                  tokens: [{ type: 'text'; value: '.' }, { type: 'variable'; name: 'minor' }]
                },
              ]
            },
          ]
          search: undefined
        }
    >
  >,
]
