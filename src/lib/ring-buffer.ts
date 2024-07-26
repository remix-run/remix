/**
 * A fast ring (or "circular") buffer implementation that supports reusing a fixed-size buffer
 * by overwriting the oldest data when the buffer is full. This is useful for buffering streaming
 * data, such as reading from a file or network socket, before handing off the data to a consumer.
 */
export class RingBuffer implements RelativeIndexable<number> {
  private buffer: Uint8Array;
  private start = 0;
  private end = 0;
  private _length = 0;
  private mask: number;

  /**
   * Creates a new RingBuffer with the given `capacity`, which must be a power of 2.
   */
  constructor(capacity: number) {
    if ((capacity & (capacity - 1)) !== 0) {
      throw new Error('Initial capacity must be a power of 2');
    }

    this.buffer = new Uint8Array(capacity);
    this.mask = capacity - 1;
  }

  /**
   * The total number of bytes this buffer can hold.
   */
  get capacity(): number {
    return this.buffer.length;
  }

  /**
   * The number of bytes in the buffer.
   */
  get length(): number {
    return this._length;
  }

  at(index: number): number | undefined {
    if (index < -this._length || index >= this._length) {
      return undefined;
    }

    if (index < 0) {
      index = this._length + index;
    }

    return this.buffer[(this.start + index) & this.mask];
  }

  /**
   * Appends a chunk of data to the buffer.
   */
  append(chunk: Uint8Array): void {
    if (chunk.length === 0) return;

    if (chunk.length + this._length > this.capacity) {
      throw new Error(`Cannot append to buffer, it is full`);
    }

    let spaceToEnd = this.capacity - this.end;
    if (chunk.length <= spaceToEnd) {
      this.buffer.set(chunk, this.end);
      this.end += chunk.length;
    } else {
      this.buffer.set(chunk.subarray(0, spaceToEnd), this.end);
      this.buffer.set(chunk.subarray(spaceToEnd), 0);
      this.end = chunk.length - spaceToEnd;
    }

    this._length += chunk.length;
  }

  /**
   * Returns the next `size` bytes from the buffer without removing them.
   */
  peek(size: number): Uint8Array {
    if (size < 0) {
      throw new Error('Cannot read a negative number of bytes');
    }
    if (size > this._length) {
      throw new Error('Cannot read past the end of the buffer');
    }

    let result: Uint8Array;
    if (this.start < this.end) {
      result = this.buffer.subarray(this.start, this.start + size);
    } else {
      result = new Uint8Array(size);
      let firstPart = Math.min(size, this.capacity - this.start);
      result.set(this.buffer.subarray(this.start, this.start + firstPart), 0);
      result.set(this.buffer.subarray(0, size - firstPart), firstPart);
    }

    return result;
  }

  /**
   * Removes and returns the next `size` bytes from the buffer.
   */
  read(size: number): Uint8Array {
    let chunk = this.peek(size);
    this.skip(size);
    return chunk;
  }

  /**
   * Removes the next `size` bytes from the buffer without returning them, effectively "skipping"
   * them and discarding the data.
   */
  skip(size: number): void {
    if (size < 0) {
      throw new Error('Cannot skip a negative number of bytes');
    }
    if (size > this._length) {
      throw new Error('Cannot skip past the end of the buffer');
    }

    this.start = (this.start + size) & this.mask;
    this._length -= size;
  }

  /**
   * Computes the skip table for the Boyer-Moore-Horspool algorithm. This can be used to
   * precompute the 3rd argument to `indexOf` to make searches more efficient when the needle
   * is known in advance.
   */
  static computeSkipTable(needle: string | Uint8Array): Uint8Array {
    const table = new Uint8Array(256).fill(needle.length);
    const lastIndex = needle.length - 1;

    for (let i = 0; i < lastIndex; i++) {
      table[typeof needle === 'string' ? needle.charCodeAt(i) : needle[i]] = lastIndex - i;
    }

    return table;
  }

  /**
   * Searches for the given value in the buffer using the Boyer-Moore-Horspool algorithm.
   * Returns the index of the first occurrence if found, or -1 if not.
   */
  indexOf(
    needle: string | Uint8Array,
    offset = 0,
    skipTable = RingBuffer.computeSkipTable(needle)
  ): number {
    if (needle.length === 0) return offset;
    if (needle.length > this._length - offset) return -1;

    let needleArray = typeof needle === 'string' ? new TextEncoder().encode(needle) : needle;
    let needleLength = needleArray.length;
    let lastIndex = needleLength - 1;

    let i = (this.start + offset) & this.mask;
    let j = offset;

    while (j < this._length - needleLength + 1) {
      let k = lastIndex;
      while (k >= 0 && this.buffer[(i + k) & this.mask] === needleArray[k]) {
        k--;
      }

      if (k < 0) {
        return j; // Found a match
      }

      let skip = skipTable[this.buffer[(i + lastIndex) & this.mask]];
      i = (i + skip) & this.mask;
      j += skip;
    }

    return -1; // Not found
  }
}
