import { RoutePattern } from './route-pattern.ts';
import type { Match } from './match/types.ts';
export type MatcherOptions = {
    /**
     * When `true`, pathname matching is case-insensitive for all patterns. Hostname is always
     * case-insensitive; search remains case-sensitive. Defaults to `false`.
     */
    ignoreCase?: boolean;
};
export type Matcher<source extends string = string> = {
    match(url: string | URL): Match<source, undefined> | null;
};
/**
 * Create a matcher for a single route pattern.
 *
 * @param pattern The route pattern to match against
 * @param options Options for matching URLs
 * @returns A matcher for the given pattern
 */
export declare function createMatcher<source extends string>(pattern: source | RoutePattern<source>, options?: MatcherOptions): Matcher<source>;
export type MultiMatcher<data = unknown> = {
    readonly ignoreCase: boolean;
    add(pattern: string | RoutePattern, data: data): void;
    /** Most specific match for `url`, or `null` when nothing matches. */
    match(url: string | URL): Match<string, data> | null;
    /** Every match for `url`, sorted from most to least specific. */
    matchAll(url: string | URL): Array<Match<string, data>>;
};
/**
 * Create a matcher for multiple route patterns.
 *
 * @param options Options for matching URLs
 * @returns A matcher that can register multiple patterns with associated data
 */
export declare function createMultiMatcher<data = unknown>(options?: MatcherOptions): MultiMatcher<data>;
//# sourceMappingURL=match.d.ts.map