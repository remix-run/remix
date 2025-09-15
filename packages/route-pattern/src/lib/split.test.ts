import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { type Split, split } from './split.ts'
import type { Assert, IsEqual } from './type-utils.d.ts'

describe('split', () => {
  it('splits route patterns into protocol, hostname, port, pathname, search', () => {
    let cases: Array<
      [
        string,
        { protocol?: string; hostname?: string; port?: string; pathname?: string; search?: string },
      ]
    > = [
      [
        'http(s)://(*host.:sub.)remix.run:8080/products(/:id/v:version)/*?q=1',
        {
          protocol: 'http(s)',
          hostname: '(*host.:sub.)remix.run',
          port: '8080',
          pathname: 'products(/:id/v:version)/*',
          search: 'q=1',
        },
      ],

      // protocol + ...
      ['http://host.com', { protocol: 'http', hostname: 'host.com' }],
      ['http://host.com:8080', { protocol: 'http', hostname: 'host.com', port: '8080' }],
      [
        'http://host.com/path/:id',
        { protocol: 'http', hostname: 'host.com', pathname: 'path/:id' },
      ],
      [
        'http://host.com:8080/path/:id',
        { protocol: 'http', hostname: 'host.com', port: '8080', pathname: 'path/:id' },
      ],
      ['http://host.com?q=1', { protocol: 'http', hostname: 'host.com', search: 'q=1' }],
      [
        'http://host.com/path/:id?q=1',
        { protocol: 'http', hostname: 'host.com', pathname: 'path/:id', search: 'q=1' },
      ],

      // hostname + ...
      ['://host.com', { hostname: 'host.com' }],
      ['://host.com:3000', { hostname: 'host.com', port: '3000' }],
      ['://host.com/path/:id', { hostname: 'host.com', pathname: 'path/:id' }],
      ['://host.com:3000/path/:id', { hostname: 'host.com', port: '3000', pathname: 'path/:id' }],
      ['://host.com?q=1', { hostname: 'host.com', search: 'q=1' }],
      ['://host.com/path/:id?q=1', { hostname: 'host.com', pathname: 'path/:id', search: 'q=1' }],

      // pathname + ...
      ['path/:id', { pathname: 'path/:id' }],
      ['path/:id?q=1', { pathname: 'path/:id', search: 'q=1' }],
      ['/path/:id', { pathname: 'path/:id' }],

      // search + ...
      ['?q=1', { search: 'q=1' }],
      ['/path/:id?q=1', { pathname: 'path/:id', search: 'q=1' }],
    ]

    for (let [input, expected] of cases) {
      assert.deepEqual(split(input), expected)
    }
  })
})

// prettier-ignore
export type Tests = [
  // should parse pathname only patterns
  Assert<IsEqual<
    Split<'path/:id'>,
    { pathname: 'path/:id' }
  >>,

  // should parse pathname with leading slash
  Assert<IsEqual<
    Split<'/path/:id'>,
    { pathname: 'path/:id' }
  >>,

  // should parse pathname with search
  Assert<IsEqual<
    Split<'path/:id?q=1'>,
    { pathname: 'path/:id'; search: 'q=1' }
  >>,

  // should parse pathname with leading slash and search
  Assert<IsEqual<
    Split<'/path/:id?q=1'>,
    { pathname: 'path/:id'; search: 'q=1' }
  >>,

  // should parse protocol + hostname
  Assert<IsEqual<
    Split<'http(s)://remix.run'>,
    { protocol: 'http(s)'; hostname: 'remix.run' }
  >>,

  // should not treat trailing ":tld" in hostname as a port
  Assert<IsEqual<
    Split<'http://remix.run.:tld/path/:id'>,
    { protocol: 'http'; hostname: 'remix.run.:tld'; pathname: 'path/:id' }
  >>,

  // should detect numeric port at end of host
  Assert<IsEqual<
    Split<'http://remix.run:8080/path/:id'>,
    { protocol: 'http'; hostname: 'remix.run'; port: '8080'; pathname: 'path/:id' }
  >>,

  // should detect numeric port without pathname
  Assert<IsEqual<
    Split<'http://remix.run:3000'>,
    { protocol: 'http'; hostname: 'remix.run'; port: '3000' }
  >>,

  // should allow host to contain other variables
  Assert<IsEqual<
    Split<'http://:sub.remix.run:8080/path/:id'>,
    { protocol: 'http'; hostname: ':sub.remix.run'; port: '8080'; pathname: 'path/:id' }
  >>,
]
