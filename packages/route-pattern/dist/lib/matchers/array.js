import { RoutePattern } from "../route-pattern.js";
/**
 * A simple array-based matcher that compiles route patterns to regular expressions.
 *
 * **Use RegExpMatcher when:**
 * - You have a single or handful of patterns
 * - Build time is critical (cold boot scenarios)
 * - Pattern set changes frequently (cheap to rebuild)
 * - Memory footprint needs to be minimal
 */
export class ArrayMatcher {
    #pairs = [];
    #count = 0;
    /**
     * @param pattern The pattern to add
     * @param data The data to associate with the pattern
     */
    add(pattern, data) {
        let routePattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern;
        this.#pairs.push({ pattern: routePattern, data });
        this.#count++;
    }
    /**
     * @param url The URL to match
     * @returns The match result, or `null` if no match was found
     */
    match(url) {
        if (typeof url === 'string')
            url = new URL(url);
        for (let { pattern, data } of this.#pairs) {
            let match = pattern.match(url);
            if (match) {
                return { data, params: match.params, url: match.url };
            }
        }
        return null;
    }
    /**
     * @param url The URL to match
     * @returns A generator that yields all matches
     */
    *matchAll(url) {
        if (typeof url === 'string')
            url = new URL(url);
        for (let { pattern, data } of this.#pairs) {
            let match = pattern.match(url);
            if (match) {
                yield { data, params: match.params, url: match.url };
            }
        }
    }
    get size() {
        return this.#count;
    }
}
