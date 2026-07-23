import type { RequestHandler } from './controller.ts';
import type { ContextEntries, ContextEntry, ContextWithEntries, ContextWithEntry, RequestContext } from './request-context.ts';
import type { DefaultOutput } from './router-types.ts';
import type { Defined } from './type-utils.ts';
/**
 * A middleware of any context transform.
 */
export type AnyMiddleware<output = DefaultOutput> = Middleware<ContextTransform, output>;
type ContextTransform = ContextEntry | ContextEntries | (<context extends RequestContext<any, any, any>>(context: context) => RequestContext<any, any, any>);
type EmptyContextTransform = readonly [];
declare const contextTransform: unique symbol;
type TransformOf<middleware> = middleware extends Middleware<infer transform, any> ? transform : EmptyContextTransform;
type ContextWithTransform<context extends RequestContext<any, any, any>, transform> = transform extends ContextEntries ? ContextWithEntries<context, transform> : transform extends ContextEntry ? ContextWithEntry<context, transform> : transform extends {
    <inputContext extends context>(context: inputContext): infer output;
} ? output extends RequestContext<any, any, any> ? output : context : context;
/**
 * Resolves the request-context type produced by a middleware tuple.
 */
export type MiddlewareContext<middleware extends readonly AnyMiddleware<any>[], context extends RequestContext<any, any, any> = RequestContext> = number extends middleware['length'] ? context : middleware extends readonly [
    infer first extends AnyMiddleware<any>,
    ...infer rest extends readonly AnyMiddleware<any>[]
] ? MiddlewareContext<rest, ContextWithTransform<context, TransformOf<first>>> : context;
/**
 * A special kind of request handler that either returns a router output or passes control
 * to the next middleware or request handler in the chain.
 *
 * @param context The request context
 * @param next A function that invokes the next middleware or request handler in the chain
 * @returns An output to short-circuit the chain, or the output from `next()` to continue
 *
 * The generic describes the context effect this middleware has. Use a `{ key, value }` object for
 * middleware that provides one context value, add a `property` field to install a direct context
 * property, or use {@link ContextEntries} for multiple values.
 */
export type Middleware<transform extends ContextTransform = EmptyContextTransform, output = DefaultOutput> = ((context: RequestContext<any, [], output>, next: NextFunction<output>) => Defined<output> | Promise<Defined<output>>) & {
    /**
     * Type-only metadata that carries the middleware's declared context effect.
     */
    readonly [contextTransform]?: transform | undefined;
};
/**
 * Creates a reusable middleware chain while preserving its exact tuple type.
 *
 * Prefer plain inline arrays for `middleware` options on routers, controllers, and actions. Use
 * this helper when a middleware chain is stored in a variable and its exact type must be preserved,
 * such as when deriving {@link MiddlewareContext} from the chain, exporting the chain for reuse, or
 * returning it from a factory.
 *
 * @param middleware The middleware functions to run in order.
 * @returns The middleware chain with its tuple type preserved.
 */
export declare function createMiddleware<const middleware extends readonly AnyMiddleware[]>(...middleware: middleware): middleware;
/**
 * A function that invokes the next middleware or handler in the chain.
 *
 * @returns The output from the downstream handler
 */
export type NextFunction<output = DefaultOutput> = () => Promise<Defined<output>>;
export declare function runMiddleware<output>(middleware: AnyMiddleware<output>[], context: RequestContext<any, any, output>, handler: RequestHandler<any, output>): Promise<Defined<output>>;
export {};
//# sourceMappingURL=middleware.d.ts.map