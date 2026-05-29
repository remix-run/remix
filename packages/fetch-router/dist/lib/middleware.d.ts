import type { RequestHandler } from './controller.ts';
import type { ContextEntries, ContextEntry, ContextWithEntries, ContextWithEntry, RequestContext } from './request-context.ts';
/**
 * A middleware of any context transform.
 */
export type AnyMiddleware = Middleware<ContextTransform>;
type ContextTransform = ContextEntry | ContextEntries | (<context extends RequestContext<any, any>>(context: context) => RequestContext<any, any>);
type EmptyContextTransform = readonly [];
declare const contextTransform: unique symbol;
type TransformOf<middleware> = middleware extends Middleware<infer transform> ? transform : EmptyContextTransform;
type ContextWithTransform<context extends RequestContext<any, any>, transform> = transform extends ContextEntries ? ContextWithEntries<context, transform> : transform extends ContextEntry ? ContextWithEntry<context, transform> : transform extends {
    <inputContext extends context>(context: inputContext): infer output;
} ? output extends RequestContext<any, any> ? output : context : context;
/**
 * Resolves the request-context type produced by a middleware tuple.
 */
export type MiddlewareContext<middleware extends readonly AnyMiddleware[], context extends RequestContext<any, any> = RequestContext> = number extends middleware['length'] ? context : middleware extends readonly [
    infer first extends AnyMiddleware,
    ...infer rest extends readonly AnyMiddleware[]
] ? MiddlewareContext<rest, ContextWithTransform<context, TransformOf<first>>> : context;
/**
 * A special kind of request handler that either returns a response or passes control
 * to the next middleware or request handler in the chain.
 *
 * @param context The request context
 * @param next A function that invokes the next middleware or request handler in the chain
 * @returns A response to short-circuit the chain, or the response from `next()` to continue
 *
 * The generic describes the context effect this middleware has. Use a `{ key, value }` object for
 * middleware that provides one context value, add a `property` field to install a direct context
 * property, or use {@link ContextEntries} for multiple values.
 */
export interface Middleware<transform extends ContextTransform = EmptyContextTransform> {
    /**
     * Handles a request and optionally delegates to the next middleware or handler.
     */
    (context: RequestContext<any>, next: NextFunction): Response | Promise<Response>;
    /**
     * Type-only metadata that carries the middleware's declared context effect.
     */
    readonly [contextTransform]?: transform | undefined;
}
/**
 * A function that invokes the next middleware or handler in the chain.
 *
 * @returns The response from the downstream handler
 */
export type NextFunction = () => Promise<Response>;
export declare function runMiddleware(middleware: AnyMiddleware[], context: RequestContext<any, any>, handler: RequestHandler<any>): Promise<Response>;
export {};
//# sourceMappingURL=middleware.d.ts.map