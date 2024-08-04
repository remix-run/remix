import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { indexOf } from './buffer-utils.js';

describe('indexOf', () => {
  it('finds the needle at the beginning of the head', () => {
    let head = new Uint8Array([1, 2, 3]);
    let tail = new Uint8Array([4, 5, 6]);
    let needle = new Uint8Array([1, 2]);
    assert.equal(indexOf(head, tail, needle), 0);
  });

  it('finds the needle at the end of the head', () => {
    let head = new Uint8Array([1, 2, 3]);
    let tail = new Uint8Array([4, 5, 6]);
    let needle = new Uint8Array([2, 3]);
    assert.equal(indexOf(head, tail, needle), 1);
  });

  it('finds the needle split between head and tail', () => {
    let head = new Uint8Array([1, 2, 3]);
    let tail = new Uint8Array([4, 5, 6]);
    assert.equal(indexOf(head, tail, new Uint8Array([2, 3, 4])), 1);
    assert.equal(indexOf(head, tail, new Uint8Array([3, 4, 5])), 2);
  });

  it('finds the needle at the beginning of the tail', () => {
    let head = new Uint8Array([1, 2, 3]);
    let tail = new Uint8Array([4, 5, 6]);
    let needle = new Uint8Array([4, 5]);
    assert.equal(indexOf(head, tail, needle), 3);
  });

  it('finds the needle at the end of the tail', () => {
    let head = new Uint8Array([1, 2, 3]);
    let tail = new Uint8Array([4, 5, 6]);
    let needle = new Uint8Array([5, 6]);
    assert.equal(indexOf(head, tail, needle), 4);
  });

  it('returns -1 when the needle is not found', () => {
    let head = new Uint8Array([1, 2, 3]);
    let tail = new Uint8Array([4, 5, 6]);
    let needle = new Uint8Array([2, 4]);
    assert.equal(indexOf(head, tail, needle), -1);
  });

  it('handles empty head correctly', () => {
    let head = new Uint8Array([]);
    let tail = new Uint8Array([1, 2, 3]);
    let needle = new Uint8Array([1, 2]);
    assert.equal(indexOf(head, tail, needle), 0);
  });

  it('handles needle equal to the total length', () => {
    let head = new Uint8Array([1, 2, 3]);
    let tail = new Uint8Array([4, 5, 6]);
    let needle = new Uint8Array([1, 2, 3, 4, 5, 6]);
    assert.equal(indexOf(head, tail, needle), 0);
  });

  it('handles needle longer than the total length', () => {
    let head = new Uint8Array([1, 2, 3]);
    let tail = new Uint8Array([4, 5, 6]);
    let needle = new Uint8Array([1, 2, 3, 4, 5, 6, 7]);
    assert.equal(indexOf(head, tail, needle), -1);
  });

  it('handles repeated patterns correctly', () => {
    let head = new Uint8Array([1, 2, 1, 2]);
    let tail = new Uint8Array([1, 2, 1, 2]);
    let needle = new Uint8Array([2, 1, 2, 1]);
    assert.equal(indexOf(head, tail, needle), 1);
  });
});
