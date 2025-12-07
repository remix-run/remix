import type { Params, RoutePattern } from '@remix-run/route-pattern'

import type { RequestContext } from './request-context.ts'
import type { RequestMethod } from './request-methods.ts'
import type { Route } from './route-map.ts'

/**
 * A request handler function that returns some kind of response.
 *
 * @param context The request context
 * @return The response
 */
export interface RequestHandler<
  method extends RequestMethod | 'ANY' = RequestMethod | 'ANY',
  params extends Record<string, any> = {},
  T = Response,
> {
  (context: RequestContext<method, params>): T | Promise<T>
}

/**
 * Build a `RequestHandler` type from a string, `RoutePattern`, or `Route`.
 */
// prettier-ignore
export type BuildRequestHandler<route extends string | RoutePattern | Route> =
  route extends string ? RequestHandler<'ANY', Params<route>> :
  route extends RoutePattern<infer pattern extends string> ? RequestHandler<'ANY', Params<pattern>> :
  route extends Route<infer method extends RequestMethod | 'ANY', infer pattern extends string> ? RequestHandler<method, Params<pattern>> :
  never
