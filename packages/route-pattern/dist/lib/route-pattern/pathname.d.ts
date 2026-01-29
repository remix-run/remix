import { PartPattern } from './part-pattern.ts';
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
 * @param ignoreCase whether to ignore case when matching
 * @returns the joined pathname pattern
 */
export declare function join(a: PartPattern, b: PartPattern, ignoreCase: boolean): PartPattern;
//# sourceMappingURL=pathname.d.ts.map