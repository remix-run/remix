import type { Params } from '@remix-run/route-pattern'

import type { RequestContext } from './request-context.ts'
import type { RequestMethod } from './request-methods.ts'
import type { Route } from './route-map.ts'

/**
 * A request handler function that returns some kind of response.
 */
export interface RequestHandler<
  Method extends RequestMethod | 'ANY' = RequestMethod | 'ANY',
  Params extends Record<string, any> = {},
  T = Response,
> {
  (context: RequestContext<Method, Params>): T | Promise<T>
}

/**
 * Infer the request handler type from a route or string.
 */
// prettier-ignore
export type InferRequestHandler<T extends Route | string> =
  T extends Route<infer M, infer P> ? RequestHandler<M, Params<P>> :
  T extends string ? RequestHandler<'ANY', Params<T>> :
  never
