import type { RoutePattern } from '../route-pattern.ts';
/**
 * - `null`: key must be present
 * - Empty `Set`: key must be present with a value
 * - Non-empty `Set`: key must be present with all these values
 *
 * ```ts
 * new Map([['q', null]])                // -> ?q, ?q=, ?q=1
 * new Map([['q', new Set()]])           // -> ?q=1
 * new Map([['q', new Set(['x', 'y'])]]) // -> ?q=x&q=y
 * ```
 */
export type Constraints = Map<string, Set<string> | null>;
/**
 * Parse a search string into search constraints.
 *
 * Search constraints define what query params must be present:
 * - `null`: param must be present (e.g., `?q`, `?q=`, `?q=1`)
 * - Empty `Set`: param must be present with a value (e.g., `?q=1`)
 * - Non-empty `Set`: param must be present with all these values (e.g., `?q=x&q=y`)
 *
 * Examples:
 * ```ts
 * parse('q')       // -> Map([['q', null]])
 * parse('q=')      // -> Map([['q', new Set()]])
 * parse('q=x&q=y') // -> Map([['q', new Set(['x', 'y'])]])
 * ```
 *
 * @param source the search string to parse (without leading `?`)
 * @returns the parsed search constraints
 */
export declare function parse(source: string): Constraints;
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
export declare function join(a: Constraints, b: Constraints): Constraints;
export type HrefParams = Record<string, string | number | null | undefined | Array<string | number | null | undefined>>;
/**
 * Convert search constraints to a query string.
 *
 * @param constraints the search constraints to convert
 * @returns the query string (without leading `?`), or undefined if empty
 */
export declare function toString(constraints: Constraints): string | undefined;
/**
 * Generate a search query string from a pattern and params.
 *
 * @param pattern the route pattern containing search constraints
 * @param params the search params to include in the href
 * @returns the query string (without leading `?`), or undefined if empty
 */
export declare function href(pattern: RoutePattern, params: HrefParams): string | undefined;
/**
 * Test if URL search params satisfy the given constraints.
 *
 * @param params the URL search params to test
 * @param constraints the search constraints to check against
 * @param ignoreCase whether to ignore case when matching param names and values
 * @returns true if the params satisfy all constraints
 */
export declare function test(params: URLSearchParams, constraints: Constraints, ignoreCase: boolean): boolean;
//# sourceMappingURL=search.d.ts.map