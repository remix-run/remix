import { parsePattern } from "./route-pattern/parse.js";
import { serializePattern, serializePatternParts } from "./route-pattern/serialize.js";
/** A parsed route pattern */
export class RoutePattern {
    protocol;
    hostname;
    port;
    pathname;
    search;
    /**
     * Create a new `RoutePattern` by parsing a source string.
     *
     * @param source The route pattern source string.
     * @returns The parsed route pattern.
     */
    static parse(source) {
        return parsePattern(source);
    }
    /**
     * Create a new `RoutePattern` from parsed parts of a route pattern.
     *
     * Useful for efficiently deriving new patterns from already parsed patterns.
     * Unless you know what you are doing, you probably want `RoutePattern.parse`.
     *
     * @param parsed Parsed route pattern parts.
     */
    constructor(parsed) {
        this.protocol = parsed.protocol;
        this.hostname = parsed.hostname;
        this.port = parsed.port;
        this.pathname = parsed.pathname;
        this.search = parsed.search;
    }
    /** Normalized string representation of this pattern */
    get source() {
        return serializePattern(this);
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
        return serializePatternParts(this);
    }
}
