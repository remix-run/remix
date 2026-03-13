import { PartPattern, type PartPatternMatch } from './route-pattern/part-pattern.ts';
import type { Join } from './types/index.ts';
import { type HrefArgs } from './route-pattern/href.ts';
import type { Params } from './route-pattern/params.ts';
type AST = {
    protocol: 'http' | 'https' | 'http(s)' | null;
    hostname: PartPattern | null;
    port: string | null;
    pathname: PartPattern;
    /**
     * - `null`: key must be present
     * - Empty `Set`: key must be present with a value
     * - Non-empty `Set`: key must be present with all these values
     *
     * ```ts
     * new Map([['q', null]])                // -> ?q, ?q=, ?q=1
     * new Map([['q', new Set()]])           // -> ?q=1
     * new Map([['q', new Set(['x', 'y'])]]) // -> ?q=x&q=y
     * ```
     */
    search: Map<string, Set<string> | null>;
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