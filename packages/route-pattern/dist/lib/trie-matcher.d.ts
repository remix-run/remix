import type { PartPattern, PartPatternMatch, PartPatternToken } from './route-pattern/part-pattern.ts';
import { RoutePattern } from './route-pattern.ts';
import type { Match, Matcher } from './matcher.ts';
type Param = Extract<PartPatternToken, {
    type: ':' | '*';
}>;
/**
 * Trie-based matcher optimized for repeated route lookups.
 */
export declare class TrieMatcher<data = unknown> implements Matcher<data> {
    /**
     * Whether pathname matching is case-insensitive.
     */
    readonly ignoreCase: boolean;
    /**
     * Trie storage used to index registered patterns.
     */
    trie: Trie<data>;
    /**
     * @param options Constructor options
     * @param options.ignoreCase When `true`, pathname matching is case-insensitive for all patterns. Defaults to `false`.
     */
    constructor(options?: {
        ignoreCase?: boolean;
    });
    /**
     * Adds a pattern and associated data to the trie.
     *
     * @param pattern Pattern to register.
     * @param data Data returned when the pattern matches.
     */
    add(pattern: string | RoutePattern, data: data): void;
    /**
     * Returns the best matching pattern for a URL.
     *
     * @param url URL to match.
     * @param compareFn Specificity comparer used to rank matches.
     * @returns The best match, or `null` when nothing matches.
     */
    match(url: string | URL, compareFn?: (a: import("./route-pattern.ts").RoutePatternMatch, b: import("./route-pattern.ts").RoutePatternMatch) => number): Match<string, data> | null;
    /**
     * Returns every pattern that matches a URL.
     *
     * @param url URL to match.
     * @param compareFn Specificity comparer used to sort matches.
     * @returns All matching routes sorted by specificity.
     */
    matchAll(url: string | URL, compareFn?: (a: import("./route-pattern.ts").RoutePatternMatch, b: import("./route-pattern.ts").RoutePatternMatch) => number): Array<Match<string, data>>;
}
type ProtocolNode<data> = {
    http: HostnameNode<data>;
    https: HostnameNode<data>;
};
type HostnameNode<data> = {
    static: Map<string, PortNode<data>>;
    dynamic: Array<{
        part: PartPattern;
        portNode: PortNode<data>;
    }>;
    any: PortNode<data>;
};
type PortNode<data> = Map<string, PathnameNode<data>>;
type PathnameNode<data> = {
    static: Map<string, PathnameNode<data>>;
    variable: Map<string, {
        regexp: RegExp;
        pathnameNode: PathnameNode<data>;
    }>;
    wildcard: Map<string, {
        regexp: RegExp;
        pathnameNode: PathnameNode<data>;
    }>;
    values: Array<{
        pattern: RoutePattern;
        data: data;
        requiredParams: Array<Param>;
        undefinedParams: Array<Param>;
    }>;
};
type SearchResult<data> = Array<{
    pattern: RoutePattern;
    data: data;
    hostname: PartPatternMatch;
    pathname: PartPatternMatch;
    params: Record<string, string | undefined>;
}>;
export declare class Trie<data = unknown> {
    #private;
    protocolNode: ProtocolNode<data>;
    constructor(options?: {
        ignoreCase?: boolean;
    });
    insert(pattern: RoutePattern, data: data): void;
    search(url: URL): SearchResult<data>;
}
export {};
//# sourceMappingURL=trie-matcher.d.ts.map