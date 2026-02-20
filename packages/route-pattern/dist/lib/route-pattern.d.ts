import { PartPattern, type PartPatternMatch } from './route-pattern/part-pattern.ts';
import type { Join, Params } from './types/index.ts';
import { type HrefArgs } from './route-pattern/href.ts';
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
    readonly ast: AST;
    constructor(source: source);
    private get hasOrigin();
    get protocol(): string;
    get hostname(): string;
    get port(): string;
    get pathname(): string;
    get search(): string;
    get source(): string;
    toString(): string;
    join<other extends string>(other: other | RoutePattern<other>): RoutePattern<Join<source, other>>;
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
    test(url: string | URL): boolean;
}
export {};
//# sourceMappingURL=route-pattern.d.ts.map