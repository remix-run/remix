import type { RequestContext } from './request-context.ts'

/**
 * A request handler function that returns some kind of response.
 */
export interface RequestHandler<Params extends Record<string, any> = {}, T = Response> {
  (context: RequestContext<Params>): T | Promise<T>
}
