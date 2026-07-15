import { RoutePattern } from "./route-pattern.js";
import { parsePattern } from "./route-pattern/parse.js";
import { Trie } from "./match/trie.js";
import * as Specificity from "./specificity.js";
/**
 * Create a matcher for a single route pattern.
 *
 * @param pattern The route pattern to match against
 * @param options Options for matching URLs
 * @returns A matcher for the given pattern
 */
export function createMatcher(pattern, options) {
    pattern = typeof pattern === 'string' ? RoutePattern.parse(pattern) : pattern;
    let matcher = createMultiMatcher(options);
    matcher.add(pattern, undefined);
    return {
        match(url) {
            return matcher.match(url);
        },
    };
}
/**
 * Create a matcher for multiple route patterns.
 *
 * @param options Options for matching URLs
 * @returns A matcher that can register multiple patterns with associated data
 */
export function createMultiMatcher(options) {
    return new TrieMatcher(options);
}
class TrieMatcher {
    ignoreCase;
    #trie;
    constructor(options) {
        this.ignoreCase = options?.ignoreCase ?? false;
        this.#trie = new Trie({ ignoreCase: this.ignoreCase });
    }
    add(pattern, data) {
        pattern = typeof pattern === 'string' ? parsePattern(pattern) : pattern;
        this.#trie.insert(pattern, data);
    }
    match(url) {
        let parsedUrl = typeof url === 'string' ? new URL(url) : url;
        let best = null;
        for (let match of this.#trie.search(parsedUrl)) {
            if (best === null || Specificity.greaterThan(match, best)) {
                best = match;
            }
        }
        return best;
    }
    matchAll(url) {
        let parsedUrl = typeof url === 'string' ? new URL(url) : url;
        let matches = [];
        for (let match of this.#trie.search(parsedUrl)) {
            matches.push(match);
        }
        return matches.sort(Specificity.descending);
    }
}
