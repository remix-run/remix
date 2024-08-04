import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { indexOf, combinedIndexOf } from './buffer-utils.js';

describe('indexOf', () => {
  it('finds the needle at the beginning', () => {
    let haystack = new Uint8Array([1, 2, 3, 4, 5]);
    let needle = new Uint8Array([1, 2]);
    assert.equal(indexOf(haystack, needle), 0);
  });

  it('finds the needle at the end', () => {
    let haystack = new Uint8Array([1, 2, 3, 4, 5]);
    let needle = new Uint8Array([4, 5]);
    assert.equal(indexOf(haystack, needle), 3);
  });

  it('finds the needle in the middle', () => {
    let haystack = new Uint8Array([1, 2, 3, 4, 5]);
    let needle = new Uint8Array([2, 3]);
    assert.equal(indexOf(haystack, needle), 1);
  });

  it('returns -1 when the needle is not found', () => {
    let haystack = new Uint8Array([1, 2, 3, 4, 5]);
    let needle = new Uint8Array([2, 4]);
    assert.equal(indexOf(haystack, needle), -1);
  });
});

describe('combinedIndexOf', () => {
  it('finds the needle at the beginning of the head', () => {
    let head = new Uint8Array([1, 2, 3]);
    let tail = new Uint8Array([4, 5, 6]);
    let needle = new Uint8Array([1, 2]);
    assert.equal(combinedIndexOf(head, tail, needle), 0);
  });

  it('finds the needle at the end of the head', () => {
    let head = new Uint8Array([1, 2, 3]);
    let tail = new Uint8Array([4, 5, 6]);
    let needle = new Uint8Array([2, 3]);
    assert.equal(combinedIndexOf(head, tail, needle), 1);
  });

  it('finds the needle split between head and tail', () => {
    let head = new Uint8Array([1, 2, 3]);
    let tail = new Uint8Array([4, 5, 6]);
    assert.equal(combinedIndexOf(head, tail, new Uint8Array([2, 3, 4])), 1);
    assert.equal(combinedIndexOf(head, tail, new Uint8Array([3, 4, 5])), 2);
  });

  it('finds the needle at the beginning of the tail', () => {
    let head = new Uint8Array([1, 2, 3]);
    let tail = new Uint8Array([4, 5, 6]);
    let needle = new Uint8Array([4, 5]);
    assert.equal(combinedIndexOf(head, tail, needle), 3);
  });

  it('finds the needle at the end of the tail', () => {
    let head = new Uint8Array([1, 2, 3]);
    let tail = new Uint8Array([4, 5, 6]);
    let needle = new Uint8Array([5, 6]);
    assert.equal(combinedIndexOf(head, tail, needle), 4);
  });

  it('returns -1 when the needle is not found', () => {
    let head = new Uint8Array([1, 2, 3]);
    let tail = new Uint8Array([4, 5, 6]);
    let needle = new Uint8Array([2, 4]);
    assert.equal(combinedIndexOf(head, tail, needle), -1);
  });

  it('handles empty head correctly', () => {
    let head = new Uint8Array([]);
    let tail = new Uint8Array([1, 2, 3]);
    let needle = new Uint8Array([1, 2]);
    assert.equal(combinedIndexOf(head, tail, needle), 0);
  });

  it('handles needle equal to the total length', () => {
    let head = new Uint8Array([1, 2, 3]);
    let tail = new Uint8Array([4, 5, 6]);
    let needle = new Uint8Array([1, 2, 3, 4, 5, 6]);
    assert.equal(combinedIndexOf(head, tail, needle), 0);
  });

  it('handles needle longer than the total length', () => {
    let head = new Uint8Array([1, 2, 3]);
    let tail = new Uint8Array([4, 5, 6]);
    let needle = new Uint8Array([1, 2, 3, 4, 5, 6, 7]);
    assert.equal(combinedIndexOf(head, tail, needle), -1);
  });

  it('handles repeated patterns correctly', () => {
    let head = new Uint8Array([1, 2, 1, 2]);
    let tail = new Uint8Array([1, 2, 1, 2]);
    let needle = new Uint8Array([2, 1, 2, 1]);
    assert.equal(combinedIndexOf(head, tail, needle), 1);
  });
});
