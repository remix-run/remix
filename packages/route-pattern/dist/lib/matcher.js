import { TrieMatcher } from "./trie-matcher.js";
/**
 * Create a new matcher.
 *
 * @param options Constructor options
 * @param options.ignoreCase When `true`, pathname matching is case-insensitive for all patterns. Defaults to `false`.
 * @returns A new matcher instance.
 */
export function createMatcher(options) {
    return new TrieMatcher(options);
}
