/** A token in a parsed pattern part (hostname or pathname). */
export type PartPatternToken = {
    readonly type: 'text';
    readonly text: string;
} | {
    readonly type: 'separator';
} | {
    readonly type: '(' | ')';
} | {
    readonly type: ':' | '*';
    readonly name: string;
};
/** Parsed form of a single URL part (hostname or pathname). */
export type PartPattern = {
    readonly tokens: ReadonlyArray<PartPatternToken>;
    /** Maps a `(` token index to the index of its matching `)`. */
    readonly optionals: ReadonlyMap<number, number>;
    readonly type: 'hostname' | 'pathname';
};
type ParsedRoutePattern = {
    readonly protocol: 'http' | 'https' | 'http(s)' | null;
    readonly hostname: PartPattern | null;
    readonly port: string | null;
    readonly pathname: PartPattern;
    /**
     * Required values keyed by search param name.
     *
     * Follows
     * [WHATWG's application/x-www-form-urlencoded parsing](https://url.spec.whatwg.org/#application/x-www-form-urlencoded) spec
     * (same as [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams#percent_encoding)).
     * For example, `+` is decoded as ` ` (literal space) instead of `%20`.
     *
     * - **Empty `Set`**: key must appear; value may be anything (including empty).
     * - **Non-empty `Set`**: key must appear with all listed values; extra values are OK.
     */
    readonly search: ReadonlyMap<string, ReadonlySet<string>>;
};
export interface RoutePatternJSON {
    protocol: string;
    hostname: string;
    port: string;
    pathname: string;
    search: string;
}
/** A parsed route pattern */
export declare class RoutePattern<source extends string = string> implements ParsedRoutePattern {
    readonly protocol: ParsedRoutePattern['protocol'];
    readonly hostname: ParsedRoutePattern['hostname'];
    readonly port: ParsedRoutePattern['port'];
    readonly pathname: ParsedRoutePattern['pathname'];
    readonly search: ParsedRoutePattern['search'];
    /**
     * Create a new `RoutePattern` by parsing a source string.
     *
     * @param source The route pattern source string.
     * @returns The parsed route pattern.
     */
    static parse<source extends string>(source: source): RoutePattern<source>;
    /**
     * Create a new `RoutePattern` from parsed parts of a route pattern.
     *
     * Useful for efficiently deriving new patterns from already parsed patterns.
     * Unless you know what you are doing, you probably want `RoutePattern.parse`.
     *
     * @param parsed Parsed route pattern parts.
     */
    constructor(parsed: ParsedRoutePattern);
    /** Normalized string representation of this pattern */
    get source(): string;
    /**
     * Returns a string representing this route pattern.
     *
     * @returns The same normalized pattern string as `RoutePattern.source`.
     */
    toString(): string;
    /**
     * Returns a JSON-serializable object containing each serialized part of this route pattern.
     *
     * @returns The serialized protocol, hostname, port, pathname, and search.
     */
    toJSON(): RoutePatternJSON;
}
export {};
//# sourceMappingURL=route-pattern.d.ts.map