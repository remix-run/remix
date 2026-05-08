import { type Matcher, RoutePattern } from '@remix-run/route-pattern';
import { type RouteMap, Route } from '@remix-run/routes';
import { type AnyMiddleware, type MiddlewareContext } from './middleware.ts';
import { RequestContext } from './request-context.ts';
import type { RequestMethod } from './request-methods.ts';
import { type RequestHandler, type Action, type Controller } from './controller.ts';
type AnyContext = RequestContext<any, any>;
type RouteTarget<pattern extends string = string, method extends RequestMethod | 'ANY' = RequestMethod | 'ANY'> = pattern | RoutePattern<pattern> | Route<method | 'ANY', pattern>;
type VerbMethod<method extends RequestMethod, context extends AnyContext> = {
    <pattern extends string, actionContext extends AnyContext = context>(route: RouteTarget<pattern, method>, action: Action<RouteTarget<pattern, method>, actionContext>): void;
};
/**
 * The normalized route entry stored in the router matcher.
 */
export interface RouteEntry {
    /**
     * The URL pattern used to match this route.
     */
    pattern: RoutePattern<string>;
    /**
     * The handler that runs when this route matches.
     */
    handler: RequestHandler<any>;
    /**
     * The request method this route handles, or `ANY` for method-agnostic routes.
     */
    method: RequestMethod | 'ANY';
    /**
     * Route-specific middleware that runs before the handler.
     */
    middleware: AnyMiddleware[] | undefined;
}
/**
 * Options for creating a router.
 */
export interface RouterOptions<context extends AnyContext = RequestContext, middleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[]> {
    /**
     * The default request handler that runs when no route matches.
     * Defaults to a 404 `Not Found` response.
     */
    defaultHandler?: RequestHandler<MiddlewareContext<middleware, context>>;
    /**
     * The matcher to use for matching routes.
     * Defaults to `createMatcher()`.
     */
    matcher?: Matcher<RouteEntry>;
    /**
     * Middleware to run for every request handled by this router.
     *
     * Keep this array tuple-typed when you want `MiddlewareContext<typeof middleware>` to preserve
     * the exact context contributions of each middleware.
     */
    middleware?: readonly [...middleware];
}
/**
 * A router maps incoming requests to request handlers.
 */
export interface Router<context extends AnyContext = RequestContext> {
    /**
     * Fetch a response from the router.
     *
     * @param input The request input to fetch
     * @param init The request init options
     * @returns The response from the route that matched the request
     */
    fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
    /**
     * Registers a handler for a specific request method and route target.
     *
     * Accepts either a plain request handler or an action object with optional inline middleware.
     */
    route<method extends RequestMethod | 'ANY', pattern extends string, actionContext extends AnyContext = context>(method: method, pattern: RouteTarget<pattern, method>, action: Action<RouteTarget<pattern, method>, actionContext>): void;
    /**
     * Maps either a single route target to an action or a route map to a controller.
     */
    map<pattern extends string, actionContext extends AnyContext = context>(target: RouteTarget<pattern>, action: Action<RouteTarget<pattern>, actionContext>): void;
    map<target extends RouteMap, controllerContext extends AnyContext = context>(target: target, controller: Controller<target, controllerContext>): void;
    /**
     * Shorthand for registering a `GET` route.
     */
    get: VerbMethod<'GET', context>;
    /**
     * Shorthand for registering a `HEAD` route.
     */
    head: VerbMethod<'HEAD', context>;
    /**
     * Shorthand for registering a `POST` route.
     */
    post: VerbMethod<'POST', context>;
    /**
     * Shorthand for registering a `PUT` route.
     */
    put: VerbMethod<'PUT', context>;
    /**
     * Shorthand for registering a `PATCH` route.
     */
    patch: VerbMethod<'PATCH', context>;
    /**
     * Shorthand for registering a `DELETE` route.
     */
    delete: VerbMethod<'DELETE', context>;
    /**
     * Shorthand for registering an `OPTIONS` route.
     */
    options: VerbMethod<'OPTIONS', context>;
}
/**
 * Create a new router.
 *
 * @param options Options to configure the router
 * @returns The new router
 */
export declare function createRouter<context extends AnyContext = RequestContext>(): Router<context>;
export declare function createRouter<context extends AnyContext = RequestContext, const middleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[]>(options: RouterOptions<context, middleware>): Router<MiddlewareContext<middleware, context>>;
export {};
//# sourceMappingURL=router.d.ts.map