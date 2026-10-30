import { Trie } from './match/trie.js';
import * as Specificity from './specificity.js';
/**
 * Create a matcher for a single route pattern.
 *
 * @param pattern The route pattern to match against
 * @param options Options for matching URLs
 * @returns A matcher for the given pattern
 */
export function createMatcher(pattern, options) {
    let matcher = createMultiMatcher(options);
    matcher.add(pattern, undefined);
    return {
        match(url, options) {
            return matcher.match(url, options);
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
        this.#trie = new Trie(options);
    }
    add(pattern, data) {
        this.#trie.insert(pattern, data);
    }
    match(url, options) {
        let parsedUrl = resolveURL(url, options);
        let best = null;
        for (let match of this.#trie.search(parsedUrl)) {
            if (best === null || Specificity.greaterThan(match, best)) {
                best = match;
            }
        }
        return best;
    }
    matchAll(url, options) {
        let parsedUrl = resolveURL(url, options);
        let matches = [];
        for (let match of this.#trie.search(parsedUrl)) {
            matches.push(match);
        }
        return matches.sort(Specificity.descending);
    }
}
function resolveURL(url, options) {
    let baseURL = options?.baseURL === undefined ? undefined : new URL(options.baseURL);
    return typeof url === 'string' ? new URL(url, baseURL) : url;
}
