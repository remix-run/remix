import type { RoutePattern } from '../route-pattern';
/**
 * Test if URL search params satisfy the given constraints.
 *
 * @param params the URL search params to test
 * @param constraints the search constraints to check against
 * @param ignoreCase whether to ignore case when matching param names and values
 * @returns true if the params satisfy all constraints
 */
export declare function matchSearch(params: URLSearchParams, constraints: RoutePattern['ast']['search'], ignoreCase: boolean): boolean;
//# sourceMappingURL=match.d.ts.map