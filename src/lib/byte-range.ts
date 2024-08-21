export interface ByteRange {
  /**
   * The start index of the range (inclusive).
   */
  start: number;
  /**
   * The end index of the range (exclusive).
   */
  end: number;
}

export function validateByteRange(range: ByteRange): void {
  if (
    (range.start < 0 &&
      (range.end < range.start || range.end >= 0) &&
      range.end !== Infinity) ||
    (range.end >= 0 && range.end < range.start) ||
    range.start === Infinity
  ) {
    throw new Error(`Invalid byte range: ${range.start}-${range.end}`);
  }
}

export function addByteRanges(a: ByteRange, b: ByteRange): ByteRange {
  return {
    start: a.start + b.start,
    end: a.end === Infinity ? b.end : a.end + b.end
  };
}
