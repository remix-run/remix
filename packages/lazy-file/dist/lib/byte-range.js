/**
 * Returns the length of the byte range in a buffer of the given `size`.
 *
 * @param range The byte range
 * @param size The total size of the buffer
 * @returns The length of the byte range
 */
export function getByteLength(range, size) {
    let [start, end] = getIndexes(range, size);
    return end - start;
}
/**
 * Resolves a byte range to absolute indexes in a buffer of the given `size`.
 *
 * @param range The byte range
 * @param size The total size of the buffer
 * @returns A tuple of `[start, end]` indexes
 */
export function getIndexes(range, size) {
    let start = Math.min(Math.max(0, range.start < 0 ? size + range.start : range.start), size);
    let end = Math.min(Math.max(start, range.end < 0 ? size + range.end : range.end), size);
    return [start, end];
}
