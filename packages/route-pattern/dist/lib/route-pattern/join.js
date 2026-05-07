import { PartPattern } from "./part-pattern.js";
/**
 * Joins two pathnames, adding slash between them if needed.
 *
 * Trailing slash is omitted from `a`.
 * A slash is added between `a` and `b` if `b` does not have a leading slash.
 *
 * Definitions:
 * - A leading slash can only have parens `(` `)` before it.
 * - A trailing slash can only have parens `(` `)` after it.
 *
 * Conceptually:
 *
 * ```ts
 * join('a', 'b') -> 'a/b'
 * join('a/', 'b') -> 'a/b'
 * join('a', '/b') -> 'a/b'
 * join('a/', '/b') -> 'a/b'
 * join('(a)', '(b)') -> '(a)/(b)'
 * join('(a/)', '(b)') -> '(a)/(b)'
 * join('(a)', '(/b)') -> '(a)(/b)'
 * join('(a/)', '(/b)') -> '(a)(/b)'
 * ```
 *
 * @param a the first pathname pattern
 * @param b the second pathname pattern
 * @returns the joined pathname pattern
 */
export function joinPathname(a, b) {
    if (a.tokens.length === 0)
        return b;
    if (b.tokens.length === 0)
        return a;
    let tokens = [];
    // if `a` has a trailing separator (only optionals after it)
    // then omit the separator
    let aLastNonOptionalIndex = a.tokens.findLastIndex((token) => token.type !== '(' && token.type !== ')');
    let aLastNonOptional = a.tokens[aLastNonOptionalIndex];
    let aHasTrailingSeparator = aLastNonOptional?.type === 'separator';
    a.tokens.forEach((token, index) => {
        if (index === aLastNonOptionalIndex && token.type === 'separator') {
            return;
        }
        tokens.push(token);
    });
    // if `b` does not have a leading separator (only optionals before it)
    // then add a separator
    let bFirstNonOptional = b.tokens.find((token) => token.type !== '(' && token.type !== ')');
    let needsSeparator = bFirstNonOptional === undefined || bFirstNonOptional.type !== 'separator';
    if (needsSeparator) {
        tokens.push({ type: 'separator' });
    }
    let tokenOffset = tokens.length;
    b.tokens.forEach((token) => {
        tokens.push(token);
    });
    let optionals = new Map();
    for (let [begin, end] of a.optionals) {
        if (aHasTrailingSeparator) {
            // one less token before this optional since trailing slash token was omitted
            if (begin > aLastNonOptionalIndex)
                begin -= 1;
            if (end > aLastNonOptionalIndex)
                end -= 1;
        }
        optionals.set(begin, end);
    }
    for (let [begin, end] of b.optionals) {
        optionals.set(tokenOffset + begin, tokenOffset + end);
    }
    return new PartPattern({ tokens, optionals }, { type: 'pathname' });
}
/**
 * Joins two search patterns, merging params and their constraints.
 *
 * Conceptually:
 *
 * ```ts
 * search('?a', '?b') -> '?a&b'
 * search('?a=1', '?a=2') -> '?a=1&a=2'
 * search('?a=1', '?b=2') -> '?a=1&b=2'
 * search('', '?a') -> '?a'
 * ```
 *
 * @param a the first search constraints
 * @param b the second search constraints
 * @returns the merged search constraints
 */
export function joinSearch(a, b) {
    let result = new Map();
    for (let [name, requiredValues] of a) {
        result.set(name, new Set(requiredValues));
    }
    for (let [name, requiredValues] of b) {
        let current = result.get(name);
        if (current === undefined) {
            result.set(name, new Set(requiredValues));
            continue;
        }
        for (let value of requiredValues) {
            current.add(value);
        }
    }
    return result;
}
