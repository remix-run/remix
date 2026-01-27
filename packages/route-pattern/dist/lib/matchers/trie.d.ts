import type { Matcher, MatchResult } from '../matcher.ts';
import { RoutePattern } from '../route-pattern.ts';
/**
 * Options for the `TrieMatcher`.
 */
export interface TrieMatcherOptions {
    /**
     * The maximum number of traversal states to explore during matching.
     *
     * This prevents excessive computation in cases with high branching (e.g., many optionals or
     * wildcards). Increase for more complex routes if you encounter truncated results.
     *
     * @default 10_000
     */
    maxTraversalStates?: number;
    /**
     * The maximum depth of nested optionals to explore in traversal.
     *
     * Limits branching in patterns like `/api(/v1(/v2(/v3)))` to prevent exponential state growth.
     * Adjust higher for apps with deeply nested optionals.
     *
     * @default 5
     */
    maxOptionalDepth?: number;
}
/**
 * A trie-based matcher optimized for large route sets with repeated matching.
 *
 * **Use TrieMatcher when:**
 * - You have 100+ route patterns
 * - Patterns are registered once and matched repeatedly (e.g., web server routing)
 * - Match performance matters more than build time
 * - You need exhaustive matching via `matchAll()`
 */
export declare class TrieMatcher<data = unknown> implements Matcher<data> {
    #private;
    /**
     * @param options Options for the matcher
     */
    constructor(options?: TrieMatcherOptions);
    /**
     * Add a pattern to the trie.
     *
     * @param pattern The pattern to add
     * @param node The data to associate with the pattern
     */
    add(pattern: string | RoutePattern, node: data): void;
    /**
     * Find the best match for a URL.
     *
     * @param url The URL to match
     * @returns The match result, or `null` if no match was found
     */
    match(url: string | URL): MatchResult<data> | null;
    /**
     * Find all matches for a URL.
     *
     * @param url The URL to match
     * @returns A generator that yields all matches
     */
    matchAll(url: string | URL): Generator<MatchResult<data>>;
    /**
     * The number of patterns in the trie.
     */
    get size(): number;
}
//# sourceMappingURL=trie.d.ts.map