import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSearch } from './buffer-search.js';

function encode(string: string): Uint8Array {
  return new TextEncoder().encode(string);
}

describe('createSearch.indexIn', () => {
  it('finds the first occurrence of a pattern in a buffer', () => {
    let search = createSearch('world');
    assert.equal(search.indexIn(encode('hello world')), 6);
  });

  it('returns -1 if the pattern is not found', () => {
    let search = createSearch('world');
    assert.equal(search.indexIn(encode('hello worl')), -1);
  });
});

describe('createSearch.endPartialIndexIn', () => {
  it('finds the last partial occurrence of a pattern in a buffer', () => {
    let search = createSearch('world');
    assert.equal(search.endPartialIndexIn(encode('hello worl')), 6);
  });

  it('returns -1 if the pattern is not found at the end', () => {
    let search = createSearch('world');
    assert.equal(search.endPartialIndexIn(encode('hello worlds')), -1);
  });
});
