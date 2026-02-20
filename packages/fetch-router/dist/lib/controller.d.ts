import type { Params, RoutePattern } from '@remix-run/route-pattern';
import type { Middleware } from './middleware.ts';
import type { RequestContext } from './request-context.ts';
import type { RequestMethod } from './request-methods.ts';
import type { Route, RouteMap } from './route-map.ts';
export type Controller<routes extends RouteMap> = ControllerWithMiddleware<routes> | ControllerWithoutMiddleware<routes>;
type ControllerWithMiddleware<routes extends RouteMap> = {
    middleware: Middleware[];
    actions: ControllerWithoutMiddleware<routes>;
} & (routes extends Record<string, any> ? {
    [name in keyof routes as routes extends any ? never : name]?: never;
} : {});
type ControllerWithoutMiddleware<routes extends RouteMap> = routes extends any ? ({
    [name in keyof routes]: (routes[name] extends Route<infer method extends RequestMethod | 'ANY', infer pattern extends string> ? Action<method, pattern> : routes[name] extends RouteMap ? Controller<routes[name]> : never);
} & {
    middleware?: never;
}) : never;
/**
 * An individual route action.
 */
export type Action<method extends RequestMethod | 'ANY', pattern extends string> = RequestHandlerWithMiddleware<method, Params<pattern>> | RequestHandler<method, Params<pattern>>;
type RequestHandlerWithMiddleware<method extends RequestMethod | 'ANY', params extends Record<string, any>> = {
    middleware: Middleware<method, params>[];
    action: RequestHandler<method, params>;
};
/**
 * Build an `Action` type from a string, `RoutePattern`, or `Route`.
 */
export type BuildAction<method extends RequestMethod | 'ANY', route extends string | RoutePattern | Route> = route extends string ? Action<method, route> : route extends RoutePattern<infer pattern> ? Action<method, pattern> : route extends Route<infer _, infer pattern> ? Action<method, pattern> : never;
/**
 * A request handler function that returns some kind of response.
 *
 * @param context The request context
 * @returns The response
 */
export interface RequestHandler<method extends RequestMethod | 'ANY' = RequestMethod | 'ANY', params extends Record<string, any> = {}> {
    (context: RequestContext<method, params>): Response | Promise<Response>;
}
/**
 * Runtime shape for a controller with middleware.
 */
export interface ControllerWithMiddlewareShape {
    middleware: Middleware[];
    actions: Record<string, unknown>;
}
/**
 * Check if an object has middleware and an `actions` property (controller with middleware).
 *
 * @param obj The object to check
 * @returns `true` if the object is a controller with middleware
 */
export declare function isControllerWithMiddleware(obj: unknown): obj is ControllerWithMiddlewareShape;
/**
 * Runtime shape for an action with middleware.
 */
export interface ActionWithMiddlewareShape {
    middleware: Middleware[];
    action: RequestHandler<any, any>;
}
/**
 * Check if an object has middleware and an `action` property (action with middleware).
 *
 * @param obj The object to check
 * @returns `true` if the object is an action with middleware
 */
export declare function isActionWithMiddleware(obj: unknown): obj is ActionWithMiddlewareShape;
export {};
//# sourceMappingURL=controller.d.ts.map