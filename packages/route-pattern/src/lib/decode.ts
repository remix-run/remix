export { toUnicode as decodeHostname } from './punycode.ts'

/**
 * Decodes valid percent-escape sequences, or returns the input unchanged when
 * it contains invalid ones.
 *
 * @param source String to decode.
 * @returns Decoded string, or `source` when it contains invalid percent-escape sequences.
 */
export function decodePathname(source: string): string {
  // coarse check for percent-encoded sequences; skip if none found.
  if (!source.includes('%')) return source

  try {
    return decodeURI(source)
  } catch {
    return source
  }
}
