import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RingBuffer } from './ring-buffer.js';

describe('RingBuffer', () => {
  it('handles initialization with the correct capacity', () => {
    let buffer = new RingBuffer(10);
    assert.equal(buffer.capacity, 10);
    assert.equal(buffer.length, 0);
  });

  it('handles appending data correctly', () => {
    let buffer = new RingBuffer(5);
    buffer.append(new Uint8Array([1, 2, 3]));
    assert.equal(buffer.length, 3);
    assert.deepEqual(buffer.read(3), new Uint8Array([1, 2, 3]));
  });

  it('handles appending an empty array', () => {
    let buffer = new RingBuffer(5);
    buffer.append(new Uint8Array([1, 2]));
    buffer.append(new Uint8Array([]));
    assert.equal(buffer.length, 2);
    assert.deepEqual(buffer.read(2), new Uint8Array([1, 2]));
  });

  it('handles appending data larger than initial capacity', () => {
    let buffer = new RingBuffer(3);
    buffer.append(new Uint8Array([1, 2, 3, 4, 5]));
    assert.equal(buffer.capacity, 6);
    assert.equal(buffer.length, 5);
    assert.deepEqual(buffer.read(5), new Uint8Array([1, 2, 3, 4, 5]));
  });

  it('handles reading data correctly', () => {
    let buffer = new RingBuffer(5);
    buffer.append(new Uint8Array([1, 2, 3, 4, 5]));
    assert.equal(buffer.length, 5);
    assert.deepEqual(buffer.read(3), new Uint8Array([1, 2, 3]));
    assert.equal(buffer.length, 2);
  });

  it('handles reading zero bytes', () => {
    let buffer = new RingBuffer(5);
    buffer.append(new Uint8Array([1, 2, 3]));
    assert.deepEqual(buffer.read(0), new Uint8Array([]));
    assert.equal(buffer.length, 3);
  });

  it('handles reading all data and then appending', () => {
    let buffer = new RingBuffer(5);
    buffer.append(new Uint8Array([1, 2, 3]));
    buffer.read(3);
    buffer.append(new Uint8Array([4, 5]));
    assert.equal(buffer.length, 2);
    assert.deepEqual(buffer.read(2), new Uint8Array([4, 5]));
  });

  it('handles circular behavior when appending', () => {
    let buffer = new RingBuffer(5);
    buffer.append(new Uint8Array([1, 2, 3, 4, 5]));
    buffer.append(new Uint8Array([6, 7]));
    assert.equal(buffer.length, 7);
    assert.deepEqual(buffer.read(5), new Uint8Array([1, 2, 3, 4, 5]));
  });

  it('handles circular behavior when reading', () => {
    let buffer = new RingBuffer(5);
    buffer.append(new Uint8Array([1, 2, 3, 4, 5]));
    assert.deepEqual(buffer.read(3), new Uint8Array([1, 2, 3]));
    buffer.append(new Uint8Array([6, 7, 8]));
    assert.equal(buffer.length, 5);
    assert.deepEqual(buffer.read(5), new Uint8Array([4, 5, 6, 7, 8]));
  });

  it('handles resizing the buffer when necessary', () => {
    let buffer = new RingBuffer(5);
    buffer.append(new Uint8Array([1, 2, 3, 4, 5]));
    buffer.append(new Uint8Array([6, 7, 8, 9, 10]));
    assert.equal(buffer.capacity, 10);
    assert.equal(buffer.length, 10);
    assert.deepEqual(buffer.read(10), new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
  });

  it('handles reading past the end of the internal buffer', () => {
    let buffer = new RingBuffer(5);
    buffer.append(new Uint8Array([1, 2, 3, 4, 5]));
    assert.deepEqual(buffer.read(3), new Uint8Array([1, 2, 3]));
    buffer.append(new Uint8Array([6, 7, 8]));
    assert.equal(buffer.length, 5);
    assert.deepEqual(buffer.read(5), new Uint8Array([4, 5, 6, 7, 8]));
    assert.equal(buffer.length, 0);
  });

  it('handles multiple resize operations', () => {
    let buffer = new RingBuffer(2);
    buffer.append(new Uint8Array([1, 2]));
    buffer.append(new Uint8Array([3, 4]));
    buffer.append(new Uint8Array([5, 6]));
    assert.equal(buffer.capacity, 8);
    assert.equal(buffer.length, 6);
    assert.deepEqual(buffer.read(6), new Uint8Array([1, 2, 3, 4, 5, 6]));
  });

  it('throws an error when reading with negative size', () => {
    let buffer = new RingBuffer(5);
    buffer.append(new Uint8Array([1, 2, 3]));
    assert.throws(() => buffer.read(-1), {
      name: 'Error',
      message: 'Requested size must be non-negative',
    });
  });

  it('handles reading with zero size', () => {
    let buffer = new RingBuffer(5);
    buffer.append(new Uint8Array([1, 2, 3]));
    assert.deepEqual(buffer.read(0), new Uint8Array([]));
  });

  it('throws an error when reading more data than available', () => {
    let buffer = new RingBuffer(5);
    buffer.append(new Uint8Array([1, 2, 3]));
    assert.equal(buffer.length, 3);
    assert.throws(() => buffer.read(4), {
      name: 'Error',
      message: 'Requested size is larger than buffer length',
    });
  });

  it('throws an error when exceeding the maximum capacity', () => {
    let buffer = new RingBuffer(5, 9);
    buffer.append(new Uint8Array([1, 2, 3, 4, 5]));
    assert.throws(() => buffer.append(new Uint8Array([6, 7, 8, 9, 10])), {
      name: 'Error',
      message: 'Buffer capacity exceeded',
    });
  });
});
