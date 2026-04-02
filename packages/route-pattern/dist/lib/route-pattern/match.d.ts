import type { RoutePattern } from '../route-pattern.ts';
/**
 * Test if URL search params satisfy the given constraints. Matching is case-sensitive.
 *
 * @param params The URL search params to test
 * @param constraints The search constraints to check against
 * @returns `true` if the params satisfy all constraints
 */
export declare function matchSearch(params: URLSearchParams, constraints: RoutePattern['ast']['search']): boolean;
//# sourceMappingURL=match.d.ts.map