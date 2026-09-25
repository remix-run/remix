/**
 * A range of bytes in a buffer.
 */
export interface ByteRange {
    /**
     * The start index of the range (inclusive). If this number is negative, it represents an offset
     * from the end of the content.
     */
    start: number;
    /**
     * The end index of the range (exclusive). If this number is negative, it represents an offset
     * from the end of the content. `Infinity` represents the end of the content.
     */
    end: number;
}
/**
 * Returns the length of the byte range in a buffer of the given `size`.
 *
 * @param range The byte range
 * @param size The total size of the buffer
 * @returns The length of the byte range
 */
export declare function getByteLength(range: ByteRange, size: number): number;
/**
 * Resolves a byte range to absolute indexes in a buffer of the given `size`.
 *
 * @param range The byte range
 * @param size The total size of the buffer
 * @returns A tuple of `[start, end]` indexes
 */
export declare function getIndexes(range: ByteRange, size: number): [number, number];
//# sourceMappingURL=byte-range.d.ts.map