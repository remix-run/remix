import { RoutePattern } from '@remix-run/route-pattern';
import { type MatchParams, type MultiMatcher } from '@remix-run/route-pattern/match';
import { type AnyMiddleware, type MiddlewareContext } from './middleware.ts';
import { type ContextWithOutput, type ContextWithParams, RequestContext, type requestContextTypes } from './request-context.ts';
import type { RequestMethod } from './request-methods.ts';
import { type RouteMap, Route } from './route-map.ts';
import type { DefaultOutput } from './router-types.ts';
import type { Defined } from './type-utils.ts';
import { type RequestHandler, type Action, type Controller } from './controller.ts';
type AnyContext = RequestContext<any, any, any>;
type RouteTarget<pattern extends string = string, method extends RequestMethod | 'ANY' = RequestMethod | 'ANY'> = pattern | RoutePattern<pattern> | Route<method | 'ANY', pattern>;
type RouteContext<context extends AnyContext, pattern extends string> = ContextWithParams<context, MatchParams<pattern>>;
type ContextShape<context extends AnyContext> = Omit<context, 'router' | typeof requestContextTypes>;
type ContextProvides<provided extends AnyContext, required extends AnyContext> = ContextShape<provided> extends ContextShape<required> ? true : false;
type ContextCompatibility<providedContext extends AnyContext, requiredContext extends AnyContext, middleware extends readonly AnyMiddleware<any>[]> = [providedContext] extends [requiredContext] ? unknown : ContextProvides<providedContext, requiredContext> extends true ? unknown : ContextProvides<MiddlewareContext<middleware, providedContext>, requiredContext> extends true ? unknown : never;
type VerbMethod<method extends RequestMethod, context extends AnyContext, output> = {
    <pattern extends string, actionContext extends AnyContext = context, const middleware extends readonly AnyMiddleware<output>[] = readonly AnyMiddleware<output>[]>(route: RouteTarget<pattern, method>, action: Action<RouteTarget<pattern, method>, actionContext, middleware, output> & ContextCompatibility<context, actionContext, middleware>): void;
};
/**
 * The normalized route entry stored in the router matcher.
 */
export interface RouteEntry<output = DefaultOutput> {
    /**
     * The URL pattern used to match this route.
     */
    pattern: RoutePattern<string>;
    /**
     * The handler that runs when this route matches.
     */
    handler: RequestHandler<any, output>;
    /**
     * The request method this route handles, or `ANY` for method-agnostic routes.
     */
    method: RequestMethod | 'ANY';
    /**
     * Action middleware that runs before the handler.
     */
    middleware: AnyMiddleware<output>[] | undefined;
}
export type MatchData<output = DefaultOutput> = RouteEntry<output>;
type MapTarget = RouteTarget | RouteMap;
/**
 * Infer the correct handler type (Action or Controller) based on the map target.
 */
export type MapHandler<target extends MapTarget, context extends AnyContext = RequestContext, output = DefaultOutput, middleware extends readonly AnyMiddleware<output>[] = readonly AnyMiddleware<output>[]> = target extends string ? Action<target, context, middleware, output> : target extends RoutePattern<infer pattern extends string> ? Action<RoutePattern<pattern>, context, middleware, output> : target extends Route<any, any> ? Action<target, context, middleware, output> : target extends RouteMap ? Controller<target, context, middleware, output> : never;
declare const routeBuilderContext: unique symbol;
declare const routeBuilderOutput: unique symbol;
/**
 * A route builder registers routes into a router.
 *
 * Route builders are useful for composing route groups with {@link RouteInstaller}. Unlike a
 * {@link Router}, a route builder cannot dispatch requests.
 */
export interface RouteBuilder<context extends AnyContext = RequestContext, output = DefaultOutput> {
    readonly [routeBuilderContext]?: context;
    readonly [routeBuilderOutput]?: output;
    /**
     * Registers a handler for a specific request method and route target.
     *
     * Accepts either a plain request handler or an action object with optional action middleware.
     */
    route<method extends RequestMethod | 'ANY', pattern extends string, actionContext extends AnyContext = context, const middleware extends readonly AnyMiddleware<output>[] = readonly AnyMiddleware<output>[]>(method: method, pattern: RouteTarget<pattern, method>, action: Action<RouteTarget<pattern, method>, actionContext, middleware, output> & ContextCompatibility<context, actionContext, middleware>): void;
    /**
     * Maps either a single route target to an action or a route map to a controller.
     */
    map<target extends MapTarget, handlerContext extends AnyContext = context, const middleware extends readonly AnyMiddleware<output>[] = readonly AnyMiddleware<output>[]>(target: target, handler: MapHandler<target, handlerContext, output, middleware> & ContextCompatibility<context, handlerContext, middleware>): void;
    /**
     * Mounts a route installer at a route pattern prefix.
     */
    mount<pattern extends string>(prefix: pattern | RoutePattern<pattern>, installer: RouteInstaller<RouteContext<context, pattern>, output>): void;
    /**
     * Shorthand for registering a `GET` route.
     */
    get: VerbMethod<'GET', context, output>;
    /**
     * Shorthand for registering a `HEAD` route.
     */
    head: VerbMethod<'HEAD', context, output>;
    /**
     * Shorthand for registering a `POST` route.
     */
    post: VerbMethod<'POST', context, output>;
    /**
     * Shorthand for registering a `PUT` route.
     */
    put: VerbMethod<'PUT', context, output>;
    /**
     * Shorthand for registering a `PATCH` route.
     */
    patch: VerbMethod<'PATCH', context, output>;
    /**
     * Shorthand for registering a `DELETE` route.
     */
    delete: VerbMethod<'DELETE', context, output>;
    /**
     * Shorthand for registering an `OPTIONS` route.
     */
    options: VerbMethod<'OPTIONS', context, output>;
}
/**
 * A function that registers a route group into a route builder.
 */
export interface RouteInstaller<context extends AnyContext = RequestContext, output = DefaultOutput> {
    (router: RouteBuilder<context, output>): void;
}
/**
 * Extracts the request-context type handled by a router or route builder.
 *
 * This is useful when you want to configure `RouterTypes.context` from a router that uses inline
 * middleware arrays.
 */
export type RouterContext<router> = router extends {
    readonly [routeBuilderContext]?: infer context;
} ? context : never;
/**
 * Extracts the output type returned by a router or route builder.
 */
export type RouterOutput<router> = router extends {
    readonly [routeBuilderOutput]?: infer output;
} ? Defined<output> : never;
/**
 * Options for creating a router.
 */
export interface RouterOptions<context extends AnyContext = RequestContext, output = DefaultOutput, middleware extends readonly AnyMiddleware<output>[] = readonly AnyMiddleware<output>[]> {
    /**
     * The default request handler that runs when no route matches.
     * Response routers default to a 404 `Not Found` response. Routers with a custom output must
     * provide this handler.
     */
    defaultHandler?: NoInfer<RequestHandler<MiddlewareContext<middleware, ContextWithOutput<context, output>>, output>>;
    /**
     * The matcher to use for matching routes.
     *
     * @default `createMultiMatcher()`
     */
    matcher?: NoInfer<MultiMatcher<MatchData<output>>>;
    /**
     * Middleware to run for every request handled by this router.
     *
     * Inline arrays are preferred. Use `createMiddleware()` only when a middleware chain is stored
     * before it is passed here and its exact tuple type must survive that boundary.
     */
    middleware?: readonly [...middleware];
}
/**
 * A router maps incoming requests to request handlers and returns their output.
 */
export interface Router<context extends AnyContext = RequestContext, output = DefaultOutput> extends RouteBuilder<context, output> {
    /**
     * Fetch an output from the router.
     *
     * @param input The request input to fetch
     * @param init The request init options
     * @returns The output from the route that matched the request
     */
    fetch(input: string | URL | Request, init?: RequestInit): Promise<Defined<output>>;
}
/**
 * Create a new router.
 *
 * @param options Options to configure the router
 * @returns The new router
 */
type CreateRouterArgs<context extends AnyContext, output, middleware extends readonly AnyMiddleware<output>[]> = [Defined<output>] extends [Response] ? [options?: RouterOptions<context, output, middleware>] : [
    options: RouterOptions<context, output, middleware> & {
        defaultHandler: NoInfer<RequestHandler<MiddlewareContext<middleware, ContextWithOutput<context, output>>, output>>;
    }
];
export declare function createRouter<context extends AnyContext = RequestContext, output = DefaultOutput, const middleware extends readonly AnyMiddleware<output>[] = readonly AnyMiddleware<output>[]>(...args: CreateRouterArgs<context, output, middleware>): Router<MiddlewareContext<middleware, ContextWithOutput<context, output>>, output>;
export declare function createRouter(): Router;
export {};
//# sourceMappingURL=router.d.ts.map