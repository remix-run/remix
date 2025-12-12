import type { RequestHandler } from './controller.ts'
import { raceRequestAbort } from './request-abort.ts'
import type { RequestContext } from './request-context.ts'
import type { RequestMethod } from './request-methods.ts'

/**
 * A special kind of request handler that either returns a response or passes control
 * to the next middleware or request handler in the chain.
 *
 * @param context The request context
 * @param next A function that invokes the next middleware or handler in the chain
 * @returns A response to short-circuit the chain, or `undefined`/`void` to continue
 */
export interface Middleware<
  method extends RequestMethod | 'ANY' = RequestMethod | 'ANY',
  params extends Record<string, any> = {},
> {
  (
    context: RequestContext<method, params>,
    next: NextFunction,
  ): Response | undefined | void | Promise<Response | undefined | void>
}

/**
 * A function that invokes the next middleware or handler in the chain.
 *
 * @returns The response from the downstream handler
 */
export type NextFunction = () => Promise<Response>

export function runMiddleware<
  method extends RequestMethod | 'ANY' = RequestMethod | 'ANY',
  params extends Record<string, any> = {},
>(
  middleware: Middleware<method, params>[],
  context: RequestContext<method, params>,
  handler: RequestHandler<method, params>,
): Promise<Response> {
  let index = -1

  let dispatch = async (i: number): Promise<Response> => {
    if (i <= index) throw new Error('next() called multiple times')
    index = i

    if (context.request.signal.aborted) {
      throw context.request.signal.reason
    }

    let fn = middleware[i]
    if (!fn) {
      return await raceRequestAbort(Promise.resolve(handler(context)), context.request)
    }

    let nextPromise: Promise<Response> | undefined
    let next: NextFunction = () => {
      nextPromise = dispatch(i + 1)
      return nextPromise
    }

    let response = await raceRequestAbort(Promise.resolve(fn(context, next)), context.request)

    // If a response was returned, short-circuit the chain
    if (response instanceof Response) {
      return response
    }

    // If the middleware called next(), use the downstream response
    if (nextPromise != null) {
      return nextPromise
    }

    // If it did not call next(), invoke downstream automatically
    return next()
  }

  return dispatch(0)
}
