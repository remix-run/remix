import type { RequestContext } from './request-context.ts'
import type { RequestMethod } from './request-methods.ts'

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
