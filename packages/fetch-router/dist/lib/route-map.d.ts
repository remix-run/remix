import { RoutePattern } from '@remix-run/route-pattern';
import type { HrefArgs, Join, RoutePatternMatch } from '@remix-run/route-pattern';
import type { RequestMethod } from './request-methods.ts';
import type { Simplify } from './type-utils.ts';
/**
 * A map of route names to `Route` objects or nested `RouteMap` objects.
 */
export interface RouteMap<pattern extends string = string> {
    [name: string]: Route<RequestMethod | 'ANY', pattern> | RouteMap<pattern>;
}
/**
 * A route definition that includes a request method and pattern.
 */
export declare class Route<method extends RequestMethod | 'ANY' = RequestMethod | 'ANY', pattern extends string = string> {
    /**
     * The HTTP method this route matches.
     */
    readonly method: method | 'ANY';
    /**
     * The pattern this route matches.
     */
    readonly pattern: RoutePattern<pattern>;
    /**
     * @param method The HTTP method this route matches
     * @param pattern The pattern this route matches
     */
    constructor(method: method | 'ANY', pattern: pattern | RoutePattern<pattern>);
    /**
     * Build a URL href for this route using the given parameters.
     *
     * @param args The parameters to use for building the href
     * @returns The built URL href
     */
    href(...args: HrefArgs<pattern>): string;
    /**
     * Match a URL against this route's pattern.
     *
     * @param url The URL to match
     * @returns The match result, or `null` if the URL doesn't match
     */
    match(url: string | URL): RoutePatternMatch<pattern> | null;
}
/**
 * Build a `Route` type from a request method and pattern.
 */
export type BuildRoute<method extends RequestMethod | 'ANY', pattern extends string | RoutePattern> = pattern extends string ? Route<method, pattern> : pattern extends RoutePattern<infer source extends string> ? Route<method, source> : never;
/**
 * Create a route map from a set of route definitions.
 *
 * @param defs The route definitions
 * @returns The route map
 */
export declare function createRoutes<const defs extends RouteDefs>(defs: defs): BuildRouteMap<'/', defs>;
/**
 * Create a route map from a set of route definitions with a base pattern.
 *
 * @param base The base pattern for all routes
 * @param defs The route definitions
 * @returns The route map
 */
export declare function createRoutes<base extends string, const defs extends RouteDefs>(base: base | RoutePattern<base>, defs: defs): BuildRouteMap<base, defs>;
export type BuildRouteMap<base extends string, defs extends RouteDefs> = Simplify<{
    -readonly [name in keyof defs]: (defs[name] extends Route<infer method extends RequestMethod | 'ANY', infer pattern extends string> ? Route<method, Join<base, pattern>> : defs[name] extends RouteDef ? BuildRouteWithBase<base, defs[name]> : defs[name] extends RouteDefs ? BuildRouteMap<base, defs[name]> : never);
}>;
type BuildRouteWithBase<base extends string, def extends RouteDef> = def extends string ? Route<'ANY', Join<base, def>> : def extends RoutePattern<infer pattern extends string> ? Route<'ANY', Join<base, pattern>> : def extends {
    method: infer method extends RequestMethod | 'ANY';
    pattern: infer pattern;
} ? (pattern extends string ? Route<method, Join<base, pattern>> : pattern extends RoutePattern<infer source extends string> ? Route<method, Join<base, source>> : never) : never;
/**
 * A map of route names to route definitions.
 */
export interface RouteDefs {
    [name: string]: Route | RouteDef | RouteDefs;
}
/**
 * A route definition that can be a string pattern, `RoutePattern`, or an object with method and
 * pattern.
 */
export type RouteDef<source extends string = string> = source | RoutePattern<source> | {
    method?: RequestMethod;
    pattern: source | RoutePattern<source>;
};
export {};
//# sourceMappingURL=route-map.d.ts.map