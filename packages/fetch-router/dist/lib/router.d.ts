import { type Matcher, type Params, RoutePattern } from '@remix-run/route-pattern';
import { type RouteMap, Route } from '@remix-run/routes';
import { type AnyMiddleware, type ApplyMiddlewareTuple } from './middleware.ts';
import { type ContextParams, RequestContext, type WithParams } from './request-context.ts';
import type { RequestMethod } from './request-methods.ts';
import { type Action, type ActionObjectWithMiddleware, type ActionObjectWithoutMiddleware, type Controller, type ControllerWithMiddleware, type ControllerWithoutMiddleware, type RequestHandler } from './controller.ts';
type AnyContext = RequestContext<any, any>;
type RouteContext<context extends AnyContext, pattern extends string> = WithParams<context, Params<pattern>>;
type RouteTarget<method extends RequestMethod | 'ANY', pattern extends string> = pattern | RoutePattern<pattern> | Route<method | 'ANY', pattern>;
type MapRouteTarget<method extends RequestMethod | 'ANY', pattern extends string> = pattern | RoutePattern<pattern> | Route<method, pattern>;
type RouteMethod<context extends AnyContext> = {
    <method extends RequestMethod | 'ANY', pattern extends string>(method: method, pattern: RouteTarget<method, pattern>, handler: RequestHandler<Params<pattern>, RouteContext<context, pattern>>): void;
    <method extends RequestMethod | 'ANY', pattern extends string>(method: method, pattern: RouteTarget<method, pattern>, action: ActionObjectWithoutMiddleware<Params<pattern>, RouteContext<context, pattern>>): void;
    <method extends RequestMethod | 'ANY', pattern extends string, middleware extends readonly AnyMiddleware[]>(method: method, pattern: RouteTarget<method, pattern>, action: ActionObjectWithMiddleware<Params<pattern>, RouteContext<context, pattern>, middleware>): void;
    <method extends RequestMethod | 'ANY', pattern extends string>(method: method, pattern: RouteTarget<method, pattern>, action: Action<method, pattern, context>): void;
};
type ActionMapping<context extends AnyContext> = {
    <method extends RequestMethod | 'ANY', pattern extends string>(target: MapRouteTarget<method, pattern>, handler: RequestHandler<Params<pattern>, RouteContext<context, pattern>>): void;
    <method extends RequestMethod | 'ANY', pattern extends string>(target: MapRouteTarget<method, pattern>, action: ActionObjectWithoutMiddleware<Params<pattern>, RouteContext<context, pattern>>): void;
    <method extends RequestMethod | 'ANY', pattern extends string, middleware extends readonly AnyMiddleware[]>(target: MapRouteTarget<method, pattern>, action: ActionObjectWithMiddleware<Params<pattern>, RouteContext<context, pattern>, middleware>): void;
    <method extends RequestMethod | 'ANY', pattern extends string>(target: MapRouteTarget<method, pattern>, action: Action<method, pattern, context>): void;
};
type ControllerMapping<context extends AnyContext> = {
    <target extends RouteMap>(target: target, controller: ControllerWithoutMiddleware<target, context>): void;
    <target extends RouteMap, middleware extends readonly AnyMiddleware[]>(target: target, controller: ControllerWithMiddleware<target, context, middleware>): void;
    <target extends RouteMap>(target: target, controller: Controller<target, context>): void;
};
type MapMethod<context extends AnyContext> = ActionMapping<context> & ControllerMapping<context>;
type VerbMethod<method extends RequestMethod, context extends AnyContext> = {
    <pattern extends string>(route: RouteTarget<method, pattern>, handler: RequestHandler<Params<pattern>, RouteContext<context, pattern>>): void;
    <pattern extends string>(route: RouteTarget<method, pattern>, action: ActionObjectWithoutMiddleware<Params<pattern>, RouteContext<context, pattern>>): void;
    <pattern extends string, middleware extends readonly AnyMiddleware[]>(route: RouteTarget<method, pattern>, action: ActionObjectWithMiddleware<Params<pattern>, RouteContext<context, pattern>, middleware>): void;
    <pattern extends string>(route: RouteTarget<method, pattern>, action: Action<method, pattern, context>): void;
};
type RouteMatchData = {
    pattern: RoutePattern<string>;
    handler: RequestHandler<any, any>;
    method: RequestMethod | 'ANY';
    middleware: AnyMiddleware[] | undefined;
};
/**
 * The normalized route-match payload stored in the router matcher.
 */
export type MatchData = RouteMatchData;
/**
 * The valid types for the first argument to `router.map()`.
 */
export type MapTarget = string | RoutePattern<string> | Route<RequestMethod | 'ANY', string> | RouteMap;
/**
 * Infer the correct handler type (Action or Controller) based on the map target.
 */
export type MapHandler<target extends MapTarget, context extends AnyContext = RequestContext> = target extends string ? Action<RequestMethod | 'ANY', target, context> : target extends RoutePattern<infer pattern extends string> ? Action<RequestMethod | 'ANY', pattern, context> : target extends Route<RequestMethod | 'ANY', infer pattern extends string> ? Action<RequestMethod | 'ANY', pattern, context> : target extends RouteMap ? Controller<target, context> : never;
/**
 * Options for creating a router.
 */
export interface RouterOptions<context extends AnyContext = RequestContext, middleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[]> {
    /**
     * The default request handler that runs when no route matches.
     *
     * @default A 404 "Not Found" response
     */
    defaultHandler?: RequestHandler<ContextParams<ApplyMiddlewareTuple<context, middleware>>, ApplyMiddlewareTuple<context, middleware>>;
    /**
     * The matcher to use for matching routes.
     *
     * @default `new ArrayMatcher()`
     */
    matcher?: Matcher<MatchData>;
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
    route: RouteMethod<context>;
    /**
     * Maps either a single route target to an action or a route map to a controller.
     */
    map: MapMethod<context>;
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
export declare function createRouter<context extends AnyContext = RequestContext, const middleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[]>(options: RouterOptions<context, middleware>): Router<ApplyMiddlewareTuple<context, middleware>>;
export {};
//# sourceMappingURL=router.d.ts.map