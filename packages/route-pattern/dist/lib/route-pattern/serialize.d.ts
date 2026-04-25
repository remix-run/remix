import type { RoutePattern } from '../route-pattern.ts';
/**
 * Serialize search constraints to a query string.
 *
 * @param constraints the search constraints to convert
 * @returns the query string (without leading `?`), or undefined if empty
 */
export declare function serializeSearch(constraints: RoutePattern['ast']['search']): string | undefined;
//# sourceMappingURL=serialize.d.ts.map