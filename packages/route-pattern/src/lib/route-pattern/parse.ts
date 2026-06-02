import { RoutePattern } from '../route-pattern.ts'
import { parsePatternParts } from './parse-parts.ts'

export { ParseError, parsePart, parsePatternParts } from './parse-parts.ts'

/**
 * Parse a route pattern source string
 *
 * @param source The pattern source, e.g. `'/users/:id'` or `'https://:tenant.example.com/dashboard?tab'`.
 * @returns The parsed pattern.
 * @throws {ParseError} When the source is malformed.
 */
export function parsePattern<source extends string>(source: source): RoutePattern<source> {
  return new RoutePattern<source>(parsePatternParts(source))
}
