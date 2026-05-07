import type { Params, RoutePattern } from '@remix-run/route-pattern';
import type { Route, RouteMap } from '@remix-run/routes';
import type { AnyMiddleware, ApplyMiddlewareTuple } from './middleware.ts';
import type { RequestContext } from './request-context.ts';
import type { WithParams } from './request-context.ts';
type ActionRoute = string | RoutePattern | Route;
type ActionPattern<route extends ActionRoute> = route extends string ? route : route extends RoutePattern<infer pattern extends string> ? pattern : route extends Route<any, infer pattern extends string> ? pattern : never;
export type ControllerWithoutMiddleware<routes extends RouteMap, context extends RequestContext<any, any>> = {
    middleware?: undefined;
    actions: ControllerActions<routes, context>;
};
export type ControllerWithMiddleware<routes extends RouteMap, context extends RequestContext<any, any>, middleware extends readonly AnyMiddleware[]> = {
    middleware: readonly [...middleware];
    actions: ControllerActions<routes, ApplyMiddlewareTuple<context, middleware>>;
};
/**
 * A controller object that maps the direct route leaves in a route map to action handlers.
 *
 * Controllers let you store related route handlers in one object while preserving the params
 * and request-context contract for each action. Nested route maps should be mapped with their
 * own controllers.
 */
export type Controller<routes extends RouteMap, context extends RequestContext<any, any> = RequestContext> = ControllerWithoutMiddleware<routes, context> | ControllerWithMiddleware<routes, context, readonly AnyMiddleware[]>;
type ControllerActions<routes extends RouteMap, context extends RequestContext<any, any>> = routes extends any ? {
    [name in keyof routes as routes[name] extends Route<any, any> ? name : never]: (routes[name] extends Route<any, infer pattern extends string> ? Action<pattern, context> : never);
} & {
    [name in keyof routes as routes[name] extends RouteMap ? name : never]?: never;
} : never;
export type ControllerInput<routes extends RouteMap, context extends RequestContext<any, any>, middleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[]> = ControllerWithoutMiddleware<routes, context> | ControllerWithMiddleware<routes, context, middleware>;
/**
 * An individual route action.
 *
 * Actions can be plain handler functions or action objects with optional inline middleware.
 */
export type Action<route extends ActionRoute, context extends RequestContext<any, any> = RequestContext, middleware extends readonly AnyMiddleware[] = readonly AnyMiddleware[]> = RequestHandler<Params<ActionPattern<route>>, WithParams<context, Params<ActionPattern<route>>>> | {
    middleware?: readonly [...middleware] | undefined;
    handler: RequestHandler<Params<ActionPattern<route>>, ApplyMiddlewareTuple<WithParams<context, Params<ActionPattern<route>>>, middleware>>;
};
/**
 * A request handler function that returns some kind of response.
 *
 * @param context The request context
 * @returns The response
 */
export interface RequestHandler<params extends Record<string, any> = {}, context extends RequestContext<any, any> = RequestContext<params>> {
    /**
     * Handles a matched request and returns the response.
     */
    (context: context): Response | Promise<Response>;
}
/**
 * Runtime shape for a controller.
 */
export interface ControllerShape {
    actions: Record<string, unknown>;
    middleware?: AnyMiddleware[];
}
/**
 * Check if an object has an object `actions` property.
 *
 * @param obj The object to check
 * @returns `true` if the object is a controller
 */
export declare function isController(obj: unknown): obj is ControllerShape;
/**
 * Runtime shape for an action object.
 */
export interface ActionObjectShape {
    middleware?: AnyMiddleware[];
    handler: RequestHandler<any, any>;
}
/**
 * Check if an object has a function `handler` property.
 *
 * @param obj The object to check
 * @returns `true` if the object is an action object
 */
export declare function isActionObject(obj: unknown): obj is ActionObjectShape;
export {};
//# sourceMappingURL=controller.d.ts.map