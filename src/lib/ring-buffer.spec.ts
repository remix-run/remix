import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RingBuffer } from './ring-buffer.js';

describe('RingBuffer', () => {
  describe('constructor', () => {
    it('handles initialization with the correct capacity', () => {
      let buffer = new RingBuffer(16);
      assert.equal(buffer.capacity, 16);
      assert.equal(buffer.length, 0);
    });
  });

  describe('at', () => {
    it('returns the value of a byte at a given index', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3, 4, 5]));
      assert.equal(buffer.at(0), 1);
      assert.equal(buffer.at(1), 2);
      assert.equal(buffer.at(2), 3);
      assert.equal(buffer.at(3), 4);
      assert.equal(buffer.at(4), 5);
      assert.equal(buffer.at(5), undefined);
      assert.equal(buffer.at(-1), 5);
      assert.equal(buffer.at(-2), 4);
      assert.equal(buffer.at(-3), 3);
      assert.equal(buffer.at(-4), 2);
      assert.equal(buffer.at(-5), 1);
      assert.equal(buffer.at(-6), undefined);
    });
  });

  describe('append', () => {
    it('handles appending data correctly', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3]));
      assert.equal(buffer.length, 3);
      assert.deepEqual(buffer.read(3), new Uint8Array([1, 2, 3]));
    });

    it('handles appending an empty array', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2]));
      buffer.append(new Uint8Array([]));
      assert.equal(buffer.length, 2);
      assert.deepEqual(buffer.read(2), new Uint8Array([1, 2]));
    });

    it('handles appending data that exactly fills the remaining capacity', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3]));
      assert.equal(buffer.length, 3);
      assert.equal(buffer.capacity, 8);

      buffer.append(new Uint8Array([4, 5, 6, 7, 8]));
      assert.equal(buffer.length, 8);
      assert.equal(buffer.capacity, 8);

      assert.deepEqual(buffer.read(8), new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
    });

    it('handles appending data that causes multiple wraps', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
      assert.deepEqual(buffer.read(2), new Uint8Array([1, 2]));
      buffer.append(new Uint8Array([9, 10]));
      assert.deepEqual(buffer.read(8), new Uint8Array([3, 4, 5, 6, 7, 8, 9, 10]));
      buffer.append(new Uint8Array([11, 12, 13, 14, 15, 16]));
      assert.deepEqual(buffer.read(6), new Uint8Array([11, 12, 13, 14, 15, 16]));
    });
  });

  describe('read', () => {
    it('handles reading data correctly', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3, 4, 5]));
      assert.equal(buffer.length, 5);
      assert.deepEqual(buffer.read(3), new Uint8Array([1, 2, 3]));
      assert.equal(buffer.length, 2);
    });

    it('handles reading zero bytes', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3]));
      assert.deepEqual(buffer.read(0), new Uint8Array([]));
      assert.equal(buffer.length, 3);
    });

    it('handles reading all data and then appending', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3]));
      buffer.read(3);
      buffer.append(new Uint8Array([4, 5]));
      assert.equal(buffer.length, 2);
      assert.deepEqual(buffer.read(2), new Uint8Array([4, 5]));
    });

    it('handles circular behavior when reading', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3, 4, 5, 6]));
      assert.deepEqual(buffer.read(4), new Uint8Array([1, 2, 3, 4]));
      buffer.append(new Uint8Array([7, 8, 9]));
      assert.equal(buffer.length, 5);
      assert.deepEqual(buffer.read(5), new Uint8Array([5, 6, 7, 8, 9]));
    });

    it('handles reading past the end of the internal buffer', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
      assert.deepEqual(buffer.read(4), new Uint8Array([1, 2, 3, 4]));
      buffer.append(new Uint8Array([9, 10, 11, 12]));
      assert.equal(buffer.length, 8);
      assert.deepEqual(buffer.read(8), new Uint8Array([5, 6, 7, 8, 9, 10, 11, 12]));
      assert.equal(buffer.length, 0);
    });

    it('throws an error when reading with negative size', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3]));
      assert.throws(() => buffer.read(-1), {
        name: 'Error',
        message: 'Cannot read a negative number of bytes',
      });
    });

    it('throws an error when reading more data than available', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3]));
      assert.equal(buffer.length, 3);
      assert.throws(() => buffer.read(4), {
        name: 'Error',
        message: 'Cannot read past the end of the buffer',
      });
    });
  });

  describe('skip', () => {
    it('handles skipping data correctly', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3, 4, 5]));
      buffer.skip(2);
      assert.equal(buffer.length, 3);
      assert.deepEqual(buffer.read(3), new Uint8Array([3, 4, 5]));
    });

    it('handles skipping with wrap-around', () => {
      let buffer = new RingBuffer(4);
      buffer.append(new Uint8Array([1, 2, 3, 4]));
      buffer.skip(3);
      buffer.append(new Uint8Array([5, 6]));
      assert.equal(buffer.length, 3);
      assert.deepEqual(buffer.read(3), new Uint8Array([4, 5, 6]));
    });

    it('handles skipping all data', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3, 4]));
      buffer.skip(4);
      assert.equal(buffer.length, 0);
      buffer.append(new Uint8Array([5, 6]));
      assert.deepEqual(buffer.read(2), new Uint8Array([5, 6]));
    });

    it('throws an error when skipping negative number of bytes', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3]));
      assert.throws(() => buffer.skip(-1), {
        name: 'Error',
        message: 'Cannot skip a negative number of bytes',
      });
    });

    it('throws an error when skipping more bytes than available', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3]));
      assert.throws(() => buffer.skip(4), {
        name: 'Error',
        message: 'Cannot skip past the end of the buffer',
      });
    });

    it('handles skipping zero bytes', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3]));
      buffer.skip(0);
      assert.equal(buffer.length, 3);
      assert.deepEqual(buffer.read(3), new Uint8Array([1, 2, 3]));
    });
  });

  describe('indexOf', () => {
    it('finds a simple pattern', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3, 4, 5]));
      assert.equal(buffer.indexOf(new Uint8Array([3, 4])), 2);
    });

    it('returns -1 when pattern is not found', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3, 4, 5]));
      assert.equal(buffer.indexOf(new Uint8Array([6])), -1);
    });

    it('handles wrap-around search', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
      buffer.skip(6);
      buffer.append(new Uint8Array([9, 10, 11, 12]));
      assert.equal(buffer.indexOf(new Uint8Array([8, 9, 10])), 1);
    });

    it('finds pattern at the beginning', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3, 4, 5]));
      assert.equal(buffer.indexOf(new Uint8Array([1, 2])), 0);
    });

    it('finds pattern at the end', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3, 4, 5]));
      assert.equal(buffer.indexOf(new Uint8Array([4, 5])), 3);
    });

    it('handles empty needle', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3]));
      assert.equal(buffer.indexOf(new Uint8Array([])), 0);
    });

    it('handles search with offset', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3, 1, 2, 3]));
      assert.equal(buffer.indexOf(new Uint8Array([1, 2]), 2), 3);
    });

    it('handles string input', () => {
      let buffer = new RingBuffer(16);
      buffer.append(new TextEncoder().encode('Hello, world!'));
      assert.equal(buffer.indexOf('world'), 7);
    });

    it('returns -1 when needle is longer than haystack', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3]));
      assert.equal(buffer.indexOf(new Uint8Array([1, 2, 3, 4])), -1);
    });

    it('uses provided skip table', () => {
      let buffer = new RingBuffer(8);
      buffer.append(new Uint8Array([1, 2, 3, 4, 5]));
      let skipTable = RingBuffer.computeSkipTable(new Uint8Array([3, 4]));
      assert.equal(buffer.indexOf(new Uint8Array([3, 4]), 0, skipTable), 2);
    });
  });
});
