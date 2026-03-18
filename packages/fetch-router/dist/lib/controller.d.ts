import type { Params, RoutePattern } from '@remix-run/route-pattern';
import type { Middleware } from './middleware.ts';
import type { RequestContext } from './request-context.ts';
import type { RequestMethod } from './request-methods.ts';
import type { Route, RouteMap } from './route-map.ts';
/**
 * Controller object that mirrors a route map with matching action handlers.
 */
export type Controller<routes extends RouteMap> = {
    actions: ControllerActions<routes>;
    middleware?: Middleware[];
};
type ControllerActions<routes extends RouteMap> = routes extends any ? {
    [name in keyof routes]: (routes[name] extends Route<infer method extends RequestMethod | 'ANY', infer pattern extends string> ? Action<method, pattern> : routes[name] extends RouteMap ? Controller<routes[name]> : never);
} : never;
/**
 * An individual route action.
 */
export type Action<method extends RequestMethod | 'ANY', pattern extends string> = RequestHandlerObject<method, Params<pattern>> | RequestHandler<method, Params<pattern>>;
type RequestHandlerObject<method extends RequestMethod | 'ANY', params extends Record<string, any>> = {
    middleware?: Middleware<method, params>[];
    action: RequestHandler<method, params>;
};
/**
 * Build an {@link Action} type from a string, {@link RoutePattern}, or {@link Route}.
 */
export type BuildAction<method extends RequestMethod | 'ANY', route extends string | RoutePattern | Route> = route extends string ? Action<method, route> : route extends RoutePattern<infer pattern> ? Action<method, pattern> : route extends Route<infer _, infer pattern> ? Action<method, pattern> : never;
/**
 * A request handler function that returns some kind of response.
 *
 * @param context The request context
 * @returns The response
 */
export interface RequestHandler<method extends RequestMethod | 'ANY' = RequestMethod | 'ANY', params extends Record<string, any> = {}> {
    /**
     * Handles a matched request and returns the response.
     */
    (context: RequestContext<params>): Response | Promise<Response>;
}
/**
 * Runtime shape for a controller.
 */
export interface ControllerShape {
    actions: Record<string, unknown>;
    middleware?: Middleware[];
}
/**
 * Check if an object has an `actions` property (controller).
 *
 * @param obj The object to check
 * @returns `true` if the object is a controller
 */
export declare function isController(obj: unknown): obj is ControllerShape;
/**
 * Runtime shape for an action object.
 */
export interface ActionObjectShape {
    middleware?: Middleware[];
    action: RequestHandler<any, any>;
}
/**
 * Check if an object has an `action` property (action object).
 *
 * @param obj The object to check
 * @returns `true` if the object is an action object
 */
export declare function isActionObject(obj: unknown): obj is ActionObjectShape;
export {};
//# sourceMappingURL=controller.d.ts.map