import { RoutePattern } from "../route-pattern.js";
import { parsePatternParts } from "./parse-parts.js";
export { ParseError, parsePart, parsePatternParts } from "./parse-parts.js";
/**
 * Parse a route pattern source string
 *
 * @param source The pattern source, e.g. `'/users/:id'` or `'https://:tenant.example.com/dashboard?tab'`.
 * @returns The parsed pattern.
 * @throws {ParseError} When the source is malformed.
 */
export function parsePattern(source) {
    return new RoutePattern(parsePatternParts(source));
}
