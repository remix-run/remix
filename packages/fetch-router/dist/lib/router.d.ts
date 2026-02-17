import { type Matcher, RoutePattern } from '@remix-run/route-pattern';
import { type Middleware } from './middleware.ts';
import type { RequestMethod } from './request-methods.ts';
import { type Controller, type Action, type RequestHandler } from './controller.ts';
import { type RouteMap, Route } from './route-map.ts';
export type MatchData = {
    handler: RequestHandler<any>;
    method: RequestMethod | 'ANY';
    middleware: Middleware<any>[] | undefined;
};
/**
 * The valid types for the first argument to `router.map()`.
 */
export type MapTarget = string | RoutePattern<string> | Route<RequestMethod | 'ANY', string> | RouteMap;
/**
 * Infer the correct handler type (Action or Controller) based on the map target.
 */
export type MapHandler<target extends MapTarget> = target extends string ? Action<RequestMethod | 'ANY', target> : target extends RoutePattern<infer pattern extends string> ? Action<RequestMethod | 'ANY', pattern> : target extends Route<RequestMethod | 'ANY', infer pattern extends string> ? Action<RequestMethod | 'ANY', pattern> : target extends RouteMap ? Controller<target> : never;
/**
 * Options for creating a router.
 */
export interface RouterOptions {
    /**
     * The default request handler that runs when no route matches.
     *
     * @default A 404 "Not Found" response
     */
    defaultHandler?: RequestHandler;
    /**
     * The matcher to use for matching routes.
     *
     * @default `new ArrayMatcher()`
     */
    matcher?: Matcher<MatchData>;
    /**
     * Global middleware to run for all routes. This middleware runs on every request before any
     * routes are matched.
     */
    middleware?: Middleware[];
}
/**
 * A router maps incoming requests to request handlers and middleware.
 */
export interface Router {
    /**
     * Fetch a response from the router.
     *
     * @param input The request input to fetch
     * @param init The request init options
     * @returns The response from the route that matched the request
     */
    fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
    /**
     * Add a route to the router.
     *
     * @param method The request method to match
     * @param pattern The pattern to match
     * @param action The action to invoke when the route matches
     */
    route<method extends RequestMethod | 'ANY', pattern extends string>(method: method, pattern: pattern | RoutePattern<pattern> | Route<method | 'ANY', pattern>, action: Action<method, pattern>): void;
    /**
     * Map a route or route map to an action or controller.
     *
     * @param target The route/pattern or route map to match
     * @param handler The action or controller to invoke when the route(s) match
     */
    map<target extends MapTarget>(target: target, handler: MapHandler<target>): void;
    /**
     * Map a `GET` route/pattern to an action.
     *
     * @param route The route/pattern to match
     * @param action The action to invoke when the route matches
     */
    get<pattern extends string>(route: pattern | RoutePattern<pattern> | Route<'GET' | 'ANY', pattern>, action: Action<'GET', pattern>): void;
    /**
     * Map a `HEAD` route/pattern to an action.
     *
     * @param route The route/pattern to match
     * @param action The action to invoke when the route matches
     */
    head<pattern extends string>(route: pattern | RoutePattern<pattern> | Route<'HEAD' | 'ANY', pattern>, action: Action<'HEAD', pattern>): void;
    /**
     * Map a `POST` route/pattern to an action.
     *
     * @param route The route/pattern to match
     * @param action The action to invoke when the route matches
     */
    post<pattern extends string>(route: pattern | RoutePattern<pattern> | Route<'POST' | 'ANY', pattern>, action: Action<'POST', pattern>): void;
    /**
     * Map a `PUT` route/pattern to an action.
     *
     * @param route The route/pattern to match
     * @param action The action to invoke when the route matches
     */
    put<pattern extends string>(route: pattern | RoutePattern<pattern> | Route<'PUT' | 'ANY', pattern>, action: Action<'PUT', pattern>): void;
    /**
     * Map a `PATCH` route/pattern to an action.
     *
     * @param route The route/pattern to match
     * @param action The action to invoke when the route matches
     */
    patch<pattern extends string>(route: pattern | RoutePattern<pattern> | Route<'PATCH' | 'ANY', pattern>, action: Action<'PATCH', pattern>): void;
    /**
     * Map a `DELETE` route/pattern to an action.
     *
     * @param route The route/pattern to match
     * @param action The action to invoke when the route matches
     */
    delete<pattern extends string>(route: pattern | RoutePattern<pattern> | Route<'DELETE' | 'ANY', pattern>, action: Action<'DELETE', pattern>): void;
    /**
     * Map an `OPTIONS` route/pattern to an action.
     *
     * @param route The route/pattern to match
     * @param action The action to invoke when the route matches
     */
    options<pattern extends string>(route: pattern | RoutePattern<pattern> | Route<'OPTIONS' | 'ANY', pattern>, action: Action<'OPTIONS', pattern>): void;
}
/**
 * Create a new router.
 *
 * @param options Options to configure the router
 * @returns The new router
 */
export declare function createRouter(options?: RouterOptions): Router;
//# sourceMappingURL=router.d.ts.map