import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { split } from './split.ts';

describe('split', () => {
  it('splits route patterns into protocol, hostname, pathname, search', () => {
    const cases: Array<[string, ReturnType<typeof split>]> = [
      [
        'http(s)://(*host.:sub.)remix.run/products(/:id/v:version)/*?q=1',
        {
          protocol: 'http(s)',
          hostname: '(*host.:sub.)remix.run',
          pathname: 'products(/:id/v:version)/*',
          search: 'q=1',
        },
      ],

      // protocol + ...
      ['http://host.com', { protocol: 'http', hostname: 'host.com' }],
      [
        'http://host.com/path/:id',
        { protocol: 'http', hostname: 'host.com', pathname: 'path/:id' },
      ],
      ['http://host.com?q=1', { protocol: 'http', hostname: 'host.com', search: 'q=1' }],
      [
        'http://host.com/path/:id?q=1',
        {
          protocol: 'http',
          hostname: 'host.com',
          pathname: 'path/:id',
          search: 'q=1',
        },
      ],

      // hostname + ...
      ['://host.com', { hostname: 'host.com' }],
      ['://host.com/path/:id', { hostname: 'host.com', pathname: 'path/:id' }],
      ['://host.com?q=1', { hostname: 'host.com', search: 'q=1' }],
      ['://host.com/path/:id?q=1', { hostname: 'host.com', pathname: 'path/:id', search: 'q=1' }],

      // pathname + ...
      ['path/:id', { pathname: 'path/:id' }],
      ['path/:id?q=1', { pathname: 'path/:id', search: 'q=1' }],

      // search + ...
      ['?q=1', { search: 'q=1' }],
    ];
    for (const [input, expected] of cases) {
      assert.deepStrictEqual(split(input), expected);
    }
  });
});
