import { RoutePattern } from './route-pattern.ts';
import type { Match, Matcher } from './matcher.ts';
/**
 * Matcher implementation that checks patterns in insertion order and sorts matches by specificity.
 */
export declare class ArrayMatcher<data> implements Matcher<data> {
    #private;
    /**
     * Whether pathname matching is case-insensitive.
     */
    readonly ignoreCase: boolean;
    /**
     * @param options Constructor options
     * @param options.ignoreCase When `true`, pathname matching is case-insensitive for all patterns. Defaults to `false`.
     */
    constructor(options?: {
        ignoreCase?: boolean;
    });
    /**
     * Adds a pattern and associated data to the matcher.
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
//# sourceMappingURL=array-matcher.d.ts.map