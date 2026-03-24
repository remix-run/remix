/**
 * Runs `decodeURI` returns the result, or returns the input unchanged when
 * it containts invalid percent-escape sequences.
 *
 * @param source String to decode
 * @returns Decoded string, or `source` when decoding is not possible
 */
export function tryDecodeURI(source: string): string {
  // `decodeURI` is slow; skip if no possible percent-encoded sequences.
  if (!source.includes('%')) return source

  try {
    return decodeURI(source)
  } catch {
    return source
  }
}
