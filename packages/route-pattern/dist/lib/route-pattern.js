import { parsePattern } from "./route-pattern/parse.js";
import { serializePattern, serializePatternParts } from "./route-pattern/serialize.js";
/**
 * A parsed route pattern.
 *
 * Create one with {@link RoutePattern.parse}. The constructor is public but takes a parsed
 * representation that is not part of the public API; prefer `RoutePattern.parse` instead. Use
 * `source`, `toString()`, `toJSON()`, and {@link getRoutePatternCaptures} for inspection.
 */
export class RoutePattern {
    /** Parsed parts of this pattern. Internal; not part of the public API. */
    _parts;
    /**
     * Create a new `RoutePattern` from its parsed parts.
     *
     * The parts are not part of the public API. Use {@link RoutePattern.parse} to create a pattern
     * from a source string.
     *
     * @param parts The parsed parts of the pattern.
     */
    constructor(parts) {
        this._parts = parts;
    }
    /**
     * Create a new `RoutePattern` by parsing a source string.
     *
     * @param source The route pattern source string.
     * @returns The parsed route pattern.
     */
    static parse(source) {
        return parsePattern(source);
    }
    /** Normalized string representation of this pattern. */
    get source() {
        return serializePattern(this._parts);
    }
    /**
     * Returns a string representing this route pattern.
     *
     * @returns The same normalized pattern string as `RoutePattern.source`.
     */
    toString() {
        return this.source;
    }
    /**
     * Returns a JSON-serializable object containing each serialized part of this route pattern.
     *
     * @returns The serialized protocol, hostname, port, pathname, and search.
     */
    toJSON() {
        return serializePatternParts(this._parts);
    }
}
export function createRoutePattern(parts) {
    return new RoutePattern(parts);
}
/**
 * Returns the hostname and pathname captures in a pattern in source order without exposing parsed
 * pattern internals.
 *
 * @param pattern The route pattern to inspect.
 * @returns Metadata for each variable and wildcard in the pattern.
 */
export function getRoutePatternCaptures(pattern) {
    let parsed = pattern._parts;
    let captures = [];
    if (parsed.hostname)
        collectCaptures(parsed.hostname, captures);
    collectCaptures(parsed.pathname, captures);
    return captures;
}
function collectCaptures(part, out) {
    let depth = 0;
    for (let token of part.tokens) {
        if (token.type === '(') {
            depth++;
        }
        else if (token.type === ')') {
            depth--;
        }
        else if (token.type === ':' || token.type === '*') {
            out.push({ part: part.type, type: token.type, name: token.name, optional: depth > 0 });
        }
    }
}
