import { Route } from "../route-map.js";
/**
 * Shorthand for a DELETE route.
 *
 * @alias del
 * @param pattern The route pattern string or {@link RoutePattern} object
 * @returns A Route configured for DELETE requests
 */
export function createDeleteRoute(pattern) {
    return new Route('DELETE', pattern);
}
/**
 * Shorthand for a GET route.
 *
 * @alias get
 * @param pattern The route pattern string or {@link RoutePattern} object
 * @returns A Route configured for GET requests
 */
export function createGetRoute(pattern) {
    return new Route('GET', pattern);
}
/**
 * Shorthand for a HEAD route.
 *
 * @alias head
 * @param pattern The route pattern string or {@link RoutePattern} object
 * @returns A Route configured for HEAD requests
 */
export function createHeadRoute(pattern) {
    return new Route('HEAD', pattern);
}
/**
 * Shorthand for a OPTIONS route.
 *
 * @alias options
 * @param pattern The route pattern string or {@link RoutePattern} object
 * @returns A Route configured for OPTIONS requests
 */
export function createOptionsRoute(pattern) {
    return new Route('OPTIONS', pattern);
}
/**
 * Shorthand for a PATCH route.
 *
 * @alias patch
 * @param pattern The route pattern string or {@link RoutePattern} object
 * @returns A Route configured for PATCH requests
 */
export function createPatchRoute(pattern) {
    return new Route('PATCH', pattern);
}
/**
 * Shorthand for a POST route.
 *
 * @alias post
 * @param pattern The route pattern string or {@link RoutePattern} object
 * @returns A Route configured for POST requests
 */
export function createPostRoute(pattern) {
    return new Route('POST', pattern);
}
/**
 * Shorthand for a PUT route.
 *
 * @alias put
 * @param pattern The route pattern string or {@link RoutePattern} object
 * @returns A Route configured for PUT requests
 */
export function createPutRoute(pattern) {
    return new Route('PUT', pattern);
}
