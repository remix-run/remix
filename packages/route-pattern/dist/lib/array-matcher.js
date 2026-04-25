import { RoutePattern } from "./route-pattern.js";
import * as Specificity from "./specificity.js";
/**
 * Matcher implementation that checks patterns in insertion order and sorts matches by specificity.
 */
export class ArrayMatcher {
    /**
     * Whether pathname matching is case-insensitive.
     */
    ignoreCase;
    #patterns = [];
    /**
     * @param options Constructor options
     * @param options.ignoreCase When `true`, pathname matching is case-insensitive for all patterns. Defaults to `false`.
     */
    constructor(options) {
        this.ignoreCase = options?.ignoreCase ?? false;
    }
    /**
     * Adds a pattern and associated data to the matcher.
     *
     * @param pattern Pattern to register.
     * @param data Data returned when the pattern matches.
     */
    add(pattern, data) {
        pattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern;
        this.#patterns.push({ pattern, data });
    }
    /**
     * Returns the best matching pattern for a URL.
     *
     * @param url URL to match.
     * @param compareFn Specificity comparer used to rank matches.
     * @returns The best match, or `null` when nothing matches.
     */
    match(url, compareFn = Specificity.descending) {
        let bestMatch = null;
        for (let entry of this.#patterns) {
            let match = entry.pattern.match(url, { ignoreCase: this.ignoreCase });
            if (match) {
                if (bestMatch === null || compareFn(match, bestMatch) < 0) {
                    bestMatch = { ...match, data: entry.data };
                }
            }
        }
        return bestMatch;
    }
    /**
     * Returns every pattern that matches a URL.
     *
     * @param url URL to match.
     * @param compareFn Specificity comparer used to sort matches.
     * @returns All matching routes sorted by specificity.
     */
    matchAll(url, compareFn = Specificity.descending) {
        let matches = [];
        for (let entry of this.#patterns) {
            let match = entry.pattern.match(url, { ignoreCase: this.ignoreCase });
            if (match) {
                matches.push({ ...match, data: entry.data });
            }
        }
        return matches.sort(compareFn);
    }
}
