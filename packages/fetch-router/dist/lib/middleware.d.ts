import type { RequestHandler } from './controller.ts';
import type { RequestContext } from './request-context.ts';
import type { RequestMethod } from './request-methods.ts';
/**
 * A special kind of request handler that either returns a response or passes control
 * to the next middleware or request handler in the chain.
 *
 * @param context The request context
 * @param next A function that invokes the next middleware or handler in the chain
 * @returns A response to short-circuit the chain, or `undefined`/`void` to continue
 */
export interface Middleware<method extends RequestMethod | 'ANY' = RequestMethod | 'ANY', params extends Record<string, any> = {}> {
    (context: RequestContext<method, params>, next: NextFunction): Response | undefined | void | Promise<Response | undefined | void>;
}
/**
 * A function that invokes the next middleware or handler in the chain.
 *
 * @returns The response from the downstream handler
 */
export type NextFunction = () => Promise<Response>;
export declare function runMiddleware<method extends RequestMethod | 'ANY' = RequestMethod | 'ANY', params extends Record<string, any> = {}>(middleware: Middleware<method, params>[], context: RequestContext<method, params>, handler: RequestHandler<method, params>): Promise<Response>;
//# sourceMappingURL=middleware.d.ts.map