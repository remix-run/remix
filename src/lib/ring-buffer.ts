/**
 * A ring buffer that automatically resizes to accomodate more data when it is full.
 */
export class RingBuffer implements RelativeIndexable<number> {
  private buffer: Uint8Array;
  private start = 0;
  private end = 0;
  private _length = 0;
  private mask: number;

  /**
   * Creates a new ring buffer with the given initial `capacity`, which must be a power of 2.
   * The buffer will automatically resize to accomodate more data when it is full, up to the
   * given `maxCapacity`.
   */
  constructor(capacity: number, public readonly maxCapacity = capacity) {
    if ((capacity & (capacity - 1)) !== 0) {
      throw new Error('Initial capacity must be a power of 2');
    }
    if (maxCapacity < capacity) {
      throw new Error('Max capacity must be greater than or equal to initial capacity');
    }

    this.buffer = new Uint8Array(capacity);
    this.mask = capacity - 1;
  }

  get capacity(): number {
    return this.buffer.length;
  }

  set capacity(newCapacity: number) {
    if ((newCapacity & (newCapacity - 1)) !== 0) {
      throw new Error('New capacity must be a power of 2');
    }
    if (newCapacity > this.maxCapacity) {
      throw new Error('New capacity exceeds max capacity');
    }

    let newBuffer = new Uint8Array(newCapacity);

    if (this._length !== 0) {
      if (this.start < this.end) {
        newBuffer.set(this.buffer.subarray(this.start, this.end), 0);
      } else {
        let firstPart = this.buffer.subarray(this.start);
        newBuffer.set(firstPart, 0);
        newBuffer.set(this.buffer.subarray(0, this.end), firstPart.length);
      }
    }

    this.buffer = newBuffer;
    this.start = 0;
    this.end = this._length;
    this.mask = newCapacity - 1;
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
   * Appends a chunk of data to the buffer. If the buffer is full, it will automatically
   * resize to accomodate the new chunk.
   */
  append(chunk: Uint8Array): void {
    if (chunk.length === 0) return;

    if (chunk.length + this._length > this.capacity) {
      let newCapacity = this.capacity * 2;
      while (newCapacity < this._length + chunk.length) {
        newCapacity *= 2;
      }
      this.capacity = newCapacity;

      return this.append(chunk);
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
   * Removes the next `size` bytes from the buffer without returning them.
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
   * make indexOf searches more efficient when the needle is known in advance.
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
