import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parse } from './parse.ts';

describe('parse', () => {
  it('parses protocol', () => {
    assert.deepStrictEqual(parse('http(s)://(*.:tenant.)remix.run/products/:id'), {
      protocol: [
        { type: 'text', value: 'http' },
        { type: 'optional', nodes: [{ type: 'text', value: 's' }] },
      ],
      hostname: [
        {
          type: 'optional',
          nodes: [
            { type: 'glob', name: undefined },
            { type: 'text', value: '.' },
            { type: 'param', name: 'tenant' },
            { type: 'text', value: '.' },
          ],
        },
        { type: 'text', value: 'remix.run' },
      ],
      pathname: [
        { type: 'text', value: 'products/' },
        { type: 'param', name: 'id' },
      ],
    });
  });
});
