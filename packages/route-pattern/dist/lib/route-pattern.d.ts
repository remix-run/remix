import { PartPattern, type PartPatternMatch } from './route-pattern/part-pattern.ts';
import type { Join } from './types/index.ts';
import { type HrefArgs } from './route-pattern/href.ts';
import type { Params } from './route-pattern/params.ts';
type AST = {
    readonly protocol: 'http' | 'https' | 'http(s)' | null;
    readonly hostname: PartPattern | null;
    readonly port: string | null;
    readonly pathname: PartPattern;
    /**
     * Required values keyed by search param name
     *
     * Follows
     * [WHATWG's application/x-www-form-urlencoded parsing](https://url.spec.whatwg.org/#application/x-www-form-urlencoded) spec
     * (same as [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams#percent_encoding)).
     * For example, `+` is decoded as ` ` (literal space) instead of `%20`.
     *
     * - **Empty `Set`**: key must appear; value may be anything (including empty).
     * - **Non-empty `Set`**: key must appear with all listed values; extra values are OK.
     *
     * Examples:
     *
     * ```ts
     * parseSearch('q')            // -> Map([['q', new Set()]])
     * parseSearch('q=')           // -> Map([['q', new Set()]])
     * parseSearch('q=x&q=y')      // -> Map([['q', new Set(['x', 'y'])]])
     * parseSearch('q&q=&q=x&q=y') // -> Map([['q', new Set(['x', 'y'])]])
     * ```
     */
    readonly search: ReadonlyMap<string, ReadonlySet<string>>;
};
/**
 * Result returned when a URL matches a route pattern.
 */
export type RoutePatternMatch<source extends string = string> = {
    pattern: RoutePattern;
    url: URL;
    params: Params<source>;
    /**
     * Rich information about matched params (variables and wildcards) in the hostname and pathname,
     * analogous to RegExp groups/indices.
     */
    paramsMeta: {
        hostname: PartPatternMatch;
        pathname: PartPatternMatch;
    };
};
/**
 * A class for matching and generating URLs based on a defined pattern.
 */
export declare class RoutePattern<source extends string = string> {
    /**
     * Parsed route-pattern AST used for matching and href generation.
     */
    readonly ast: AST;
    constructor(source: source);
    private get hasOrigin();
    /**
     * The protocol portion of the pattern without the trailing colon.
     */
    get protocol(): string;
    /**
     * The hostname portion of the pattern.
     */
    get hostname(): string;
    /**
     * The explicit port portion of the pattern.
     */
    get port(): string;
    /**
     * The pathname portion of the pattern without a leading slash.
     */
    get pathname(): string;
    /**
     * The serialized search constraints without a leading `?`.
     */
    get search(): string;
    /**
     * The serialized route-pattern source string.
     */
    get source(): string;
    /**
     * Returns the serialized route-pattern source string.
     *
     * @returns The pattern source.
     */
    toString(): string;
    /**
     * Joins this pattern with another pathname or route pattern.
     *
     * @param other Pattern or pathname to append.
     * @returns A new route pattern representing the joined path.
     */
    join<other extends string>(other: other | RoutePattern<other>): RoutePattern<Join<source, other>>;
    /**
     * Builds an href from this pattern and the supplied params.
     *
     * @param args Path params and optional search params.
     * @returns The generated href string.
     */
    href(...args: HrefArgs<source>): string;
    /**
     * Match a URL against this pattern.
     *
     * @param url The URL to match
     * @param options Match options
     * @param options.ignoreCase When `true`, pathname matching is case-insensitive. Defaults to `false`. Hostname is always case-insensitive; search remains case-sensitive.
     * @returns The match result, or `null` if no match
     */
    match(url: string | URL, options?: {
        ignoreCase?: boolean;
    }): RoutePatternMatch<source> | null;
    /**
     * Tests whether a URL matches this route pattern.
     *
     * @param url URL to test.
     * @returns `true` when the URL matches the pattern.
     */
    test(url: string | URL): boolean;
}
export {};
//# sourceMappingURL=route-pattern.d.ts.map