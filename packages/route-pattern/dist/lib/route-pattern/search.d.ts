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
/**
 * Convert search constraints to a query string.
 *
 * @param constraints the search constraints to convert
 * @returns the query string (without leading `?`), or undefined if empty
 */
export declare function toString(constraints: Constraints): string | undefined;
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