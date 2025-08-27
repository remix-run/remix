import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { split } from './split.ts'

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

      // search + ...
      ['?q=1', { search: 'q=1' }],
    ]

    for (let [input, expected] of cases) {
      let spans = split(input)
      let result: {
        protocol?: string
        hostname?: string
        port?: string
        pathname?: string
        search?: string
      } = {}

      if (spans.protocol) {
        result.protocol = input.slice(...spans.protocol)
      }
      if (spans.hostname) {
        result.hostname = input.slice(...spans.hostname)
      }
      if (spans.port) {
        result.port = input.slice(...spans.port)
      }
      if (spans.pathname) {
        result.pathname = input.slice(...spans.pathname)
      }
      if (spans.search) {
        result.search = input.slice(...spans.search)
      }

      assert.deepEqual(result, expected)
    }
  })
})
