import type { Matcher, MatchResult } from '../matcher.ts';
import { RoutePattern } from '../route-pattern.ts';
/**
 * A simple array-based matcher that compiles route patterns to regular expressions.
 *
 * **Use RegExpMatcher when:**
 * - You have a single or handful of patterns
 * - Build time is critical (cold boot scenarios)
 * - Pattern set changes frequently (cheap to rebuild)
 * - Memory footprint needs to be minimal
 */
export declare class ArrayMatcher<data = unknown> implements Matcher<data> {
    #private;
    /**
     * @param pattern The pattern to add
     * @param data The data to associate with the pattern
     */
    add<source extends string>(pattern: source | RoutePattern<source>, data: data): void;
    /**
     * @param url The URL to match
     * @returns The match result, or `null` if no match was found
     */
    match(url: string | URL): MatchResult<data> | null;
    /**
     * @param url The URL to match
     * @returns A generator that yields all matches
     */
    matchAll(url: string | URL): Generator<MatchResult<data>>;
    get size(): number;
}
//# sourceMappingURL=array.d.ts.map