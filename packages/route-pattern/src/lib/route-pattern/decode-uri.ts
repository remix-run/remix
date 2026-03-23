/**
 * Runs `decodeURI` on `encoded` and returns the result, or returns `encoded` unchanged when
 * `decodeURI` throws (invalid percent-escapes) so callers never get a `URIError`.
 *
 * @param encoded String to decode (for example `url.pathname.slice(1)`)
 * @returns Decoded string, or `encoded` when decoding is not possible
 */
export function tryDecodeURI(encoded: string): string {
  try {
    return decodeURI(encoded)
  } catch {
    return encoded
  }
}
