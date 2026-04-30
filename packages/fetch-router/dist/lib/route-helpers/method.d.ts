import type { RoutePattern } from '@remix-run/route-pattern';
import { Route } from '../route-map.ts';
/**
 * Shorthand for a DELETE route.
 *
 * @alias del
 * @param pattern The route pattern string or {@link RoutePattern} object
 * @returns A Route configured for DELETE requests
 */
export declare function createDeleteRoute<source extends string>(pattern: source | RoutePattern<source>): Route<'DELETE', source>;
/**
 * Shorthand for a GET route.
 *
 * @alias get
 * @param pattern The route pattern string or {@link RoutePattern} object
 * @returns A Route configured for GET requests
 */
export declare function createGetRoute<source extends string>(pattern: source | RoutePattern<source>): Route<'GET', source>;
/**
 * Shorthand for a HEAD route.
 *
 * @alias head
 * @param pattern The route pattern string or {@link RoutePattern} object
 * @returns A Route configured for HEAD requests
 */
export declare function createHeadRoute<source extends string>(pattern: source | RoutePattern<source>): Route<'HEAD', source>;
/**
 * Shorthand for a OPTIONS route.
 *
 * @alias options
 * @param pattern The route pattern string or {@link RoutePattern} object
 * @returns A Route configured for OPTIONS requests
 */
export declare function createOptionsRoute<source extends string>(pattern: source | RoutePattern<source>): Route<'OPTIONS', source>;
/**
 * Shorthand for a PATCH route.
 *
 * @alias patch
 * @param pattern The route pattern string or {@link RoutePattern} object
 * @returns A Route configured for PATCH requests
 */
export declare function createPatchRoute<source extends string>(pattern: source | RoutePattern<source>): Route<'PATCH', source>;
/**
 * Shorthand for a POST route.
 *
 * @alias post
 * @param pattern The route pattern string or {@link RoutePattern} object
 * @returns A Route configured for POST requests
 */
export declare function createPostRoute<source extends string>(pattern: source | RoutePattern<source>): Route<'POST', source>;
/**
 * Shorthand for a PUT route.
 *
 * @alias put
 * @param pattern The route pattern string or {@link RoutePattern} object
 * @returns A Route configured for PUT requests
 */
export declare function createPutRoute<source extends string>(pattern: source | RoutePattern<source>): Route<'PUT', source>;
//# sourceMappingURL=method.d.ts.map