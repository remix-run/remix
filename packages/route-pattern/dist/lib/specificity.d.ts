import type { RoutePatternMatch } from './route-pattern.ts';
/**
 * Returns true if match `a` is less specific than match `b`.
 *
 * @param a the first match to compare
 * @param b the second match to compare
 * @returns true if `a` is less specific than `b`
 */
export declare function lessThan(a: RoutePatternMatch, b: RoutePatternMatch): boolean;
/**
 * Returns true if match `a` is more specific than match `b`.
 *
 * @param a the first match to compare
 * @param b the second match to compare
 * @returns true if `a` is more specific than `b`
 */
export declare function greaterThan(a: RoutePatternMatch, b: RoutePatternMatch): boolean;
/**
 * Returns true if matches `a` and `b` have equal specificity.
 *
 * @param a the first match to compare
 * @param b the second match to compare
 * @returns true if `a` and `b` have equal specificity
 */
export declare function equal(a: RoutePatternMatch, b: RoutePatternMatch): boolean;
/**
 * Comparator function for sorting matches from least specific to most specific.
 *
 * @param a the first match to compare
 * @param b the second match to compare
 * @returns negative if `a` is less specific, positive if more specific, 0 if equal
 */
export declare let ascending: (a: RoutePatternMatch, b: RoutePatternMatch) => number;
/**
 * Comparator function for sorting matches from most specific to least specific.
 *
 * @param a the first match to compare
 * @param b the second match to compare
 * @returns positive if `a` is less specific, negative if more specific, 0 if equal
 */
export declare let descending: (a: RoutePatternMatch, b: RoutePatternMatch) => number;
/**
 * Compare two matches by specificity.
 * Passing to `.sort()` will sort matches from least specific to most specific.
 *
 * @param a the first match to compare
 * @param b the second match to compare
 * @returns -1 if `a` is less specific, 1 if `a` is more specific, 0 if tied.
 */
export declare function compare(a: RoutePatternMatch, b: RoutePatternMatch): -1 | 0 | 1;
//# sourceMappingURL=specificity.d.ts.map