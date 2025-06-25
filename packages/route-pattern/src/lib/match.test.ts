import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMatcher } from './match.ts';

describe('match', () => {
  it('matches', () => {
    const matcher = createMatcher([
      'products/:id',
      'products/sku-:sku(/compare/sku-:sku2)',
      'blog/:year-:month-:day/:slug(.html)',
      '://:tenant.remix.run/admin/users/:userId',
    ]);

    const url = 'https://remix.run/products/wireless-headphones';

    assert.deepStrictEqual(matcher.match(url), [
      { pattern: 'products/:id', params: { id: 'wireless-headphones' } },
    ]);
  });
});
