import type { RoutePattern } from '../route-pattern.ts';
type Pathname = RoutePattern['ast']['pathname'];
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
export declare function joinPathname(a: Pathname, b: Pathname): Pathname;
type Search = RoutePattern['ast']['search'];
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
export declare function joinSearch(a: Search, b: Search): Search;
export {};
//# sourceMappingURL=join.d.ts.map