/**
 * A ring buffer that automatically resizes to accomodate more data when it is full.
 */
export class RingBuffer {
  private start = 0;
  private end = 0;
  private _length = 0;
  private buffer: Uint8Array;

  constructor(initialCapacity: number, public maxCapacity = Infinity) {
    this.buffer = new Uint8Array(initialCapacity);
  }

  /**
   * The maximum number of bytes the buffer can hold.
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

  private resize(newCapacity: number): void {
    let newBuffer = new Uint8Array(newCapacity);
    let length = this._length;

    if (length === 0) {
      this.buffer = newBuffer;
      this.start = this.end = 0;
      return;
    }

    if (this.start < this.end) {
      newBuffer.set(this.buffer.subarray(this.start, this.end), 0);
    } else {
      let firstPart = this.buffer.subarray(this.start);
      newBuffer.set(firstPart, 0);
      newBuffer.set(this.buffer.subarray(0, this.end), firstPart.length);
    }

    this.buffer = newBuffer;
    this.start = 0;
    this.end = length;
  }

  /**
   * Appends a chunk of data to the buffer. If the buffer is full, it will be resized.
   */
  append(chunk: Uint8Array): void {
    if (chunk.length === 0) return;

    if (chunk.length > this.capacity - this._length) {
      let minCapacity = this._length + chunk.length;
      if (minCapacity > this.maxCapacity) {
        throw new Error('Buffer capacity exceeded');
      }
      let newCapacity = Math.min(Math.max(this.capacity * 2, minCapacity), this.maxCapacity);
      this.resize(newCapacity);
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
   * Removes and returns the next `size` bytes from the buffer.
   */
  read(size: number): Uint8Array {
    if (size < 0) {
      throw new Error('Requested size must be non-negative');
    }
    if (size > this._length) {
      throw new Error('Requested size is larger than buffer length');
    }

    let result = new Uint8Array(size);

    if (this.start < this.end) {
      result.set(this.buffer.subarray(this.start, this.start + size), 0);
    } else {
      let firstPart = Math.min(size, this.capacity - this.start);
      result.set(this.buffer.subarray(this.start, this.start + firstPart), 0);
      result.set(this.buffer.subarray(0, size - firstPart), firstPart);
    }

    this.start = (this.start + size) % this.capacity;
    this._length -= size;

    return result;
  }

  /**
   * Removes the next `size` bytes from the buffer without returning them.
   */
  skip(size: number): void {
    if (size < 0) {
      throw new Error('Requested size must be non-negative');
    }
    if (size > this._length) {
      throw new Error('Requested size is larger than buffer length');
    }

    this.start = (this.start + size) % this.capacity;
    this._length -= size;
  }

  /**
   * Returns the index of the first occurrence of `needle` in the buffer starting at `offset`.
   */
  find(needle: Uint8Array, skipTable = RingBuffer.computeSkipTable(needle), offset = 0): number {
    // boyer-moore-horspool algorithm
    if (needle.length === 0 || needle.length > this._length - offset) {
      return -1;
    }

    let bufferLength = this.buffer.length;
    let searchStart = (this.start + offset) % bufferLength;
    let remaining = this._length - offset;

    while (remaining >= needle.length) {
      let j = needle.length - 1;
      let i = searchStart + j;
      if (i >= bufferLength) {
        i -= bufferLength;
      }

      // Check characters from right to left
      while (j >= 0 && this.buffer[i] === needle[j]) {
        j--;
        i = i === 0 ? bufferLength - 1 : i - 1;
      }

      if (j < 0) {
        // Match found
        return offset;
      }

      // Shift based on the skip table
      let shift = skipTable[this.buffer[i]];
      searchStart += shift;
      if (searchStart >= bufferLength) {
        searchStart -= bufferLength;
      }
      offset += shift;
      remaining -= shift;
    }

    return -1;
  }

  /**
   * Computes a skip table ahead of time to use later with `buffer.find(needle, skipTable)`.
   * This can improve performance when searching for the same `needle` multiple times.
   */
  static computeSkipTable(needle: Uint8Array): Uint8Array {
    let skipTable = new Uint8Array(256).fill(needle.length);

    for (let i = 0; i < needle.length - 1; i++) {
      skipTable[needle[i]] = needle.length - 1 - i;
    }

    return skipTable;
  }
}
