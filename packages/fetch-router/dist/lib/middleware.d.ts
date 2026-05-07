import type { RequestHandler } from './controller.ts';
import type { ContextEntries, RequestContext } from './request-context.ts';
/**
 * A middleware of any params or context transform.
 */
export type AnyMiddleware = Middleware<any, any>;
/**
 * The type-level effect a middleware can apply to request context.
 */
export type MiddlewareContextTransform = ContextEntries | (<context extends RequestContext<any, any>>(context: context) => RequestContext<any, any>);
type IdentityContextTransform = readonly [];
type MiddlewareTransform<middleware> = middleware extends Middleware<any, infer transform> ? transform : IdentityContextTransform;
/**
 * Applies a middleware context transform to a request-context type.
 */
export type ApplyContextTransform<currentContext extends RequestContext<any, any>, transform> = transform extends ContextEntries ? currentContext extends RequestContext<infer params extends Record<string, any>, infer entries extends ContextEntries> ? RequestContext<params, [...entries, ...transform]> : currentContext : transform extends {
    <inputContext extends currentContext>(context: inputContext): infer output;
} ? output extends RequestContext<any, any> ? output : currentContext : currentContext;
/**
 * Applies the declared context effect of a single middleware to a request-context type.
 */
export type ApplyMiddleware<context extends RequestContext<any, any>, middleware> = ApplyContextTransform<context, MiddlewareTransform<middleware>>;
/**
 * Applies an ordered middleware array to a request-context type from left to right.
 */
export type ApplyMiddlewareTuple<context extends RequestContext<any, any>, middleware> = middleware extends readonly AnyMiddleware[] ? number extends middleware['length'] ? context : middleware extends readonly [infer first, ...infer rest] ? ApplyMiddlewareTuple<ApplyMiddleware<context, first>, rest> : context : context;
/**
 * Resolves the request-context type produced by a router middleware array.
 */
export type MiddlewareContext<middleware extends readonly AnyMiddleware[]> = ApplyMiddlewareTuple<RequestContext, middleware>;
/**
 * A special kind of request handler that either returns a response or passes control
 * to the next middleware or request handler in the chain.
 *
 * @param context The request context
 * @param next A function that invokes the next middleware or request handler in the chain
 * @returns A response to short-circuit the chain, or `undefined`/`void` to continue
 */
export interface Middleware<params extends Record<string, any> = {}, transform extends MiddlewareContextTransform = IdentityContextTransform> {
    /**
     * Handles a request and optionally delegates to the next middleware or handler.
     */
    (context: RequestContext<params>, next: NextFunction): Response | undefined | void | Promise<Response | undefined | void>;
    /**
     * Type-only metadata that carries the middleware's declared context effect.
     */
    readonly '~contextTransform'?: transform | undefined;
}
/**
 * A function that invokes the next middleware or handler in the chain.
 *
 * @returns The response from the downstream handler
 */
export type NextFunction = () => Promise<Response>;
export declare function runMiddleware<params extends Record<string, any> = {}>(middleware: AnyMiddleware[], context: RequestContext<params>, handler: RequestHandler<params, any>): Promise<Response>;
export {};
//# sourceMappingURL=middleware.d.ts.map