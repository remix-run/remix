import { raceRequestAbort } from './request-abort.ts'
import type { RequestContext } from './request-context.ts'
import type { RequestHandler } from './request-handler.ts'
import type { RequestMethod } from './request-methods.ts'

/**
 * A special kind of request handler that either returns a response or passes control
 * to the next middleware or request handler in the chain.
 */
export interface Middleware<
  Method extends RequestMethod | 'ANY' = RequestMethod | 'ANY',
  Params extends Record<string, any> = {},
> {
  (
    context: RequestContext<Method, Params>,
    next: NextFunction,
  ): Response | undefined | void | Promise<Response | undefined | void>
}

export type NextFunction = () => Promise<Response>

export function runMiddleware<
  Method extends RequestMethod | 'ANY' = RequestMethod | 'ANY',
  Params extends Record<string, any> = {},
>(
  middleware: Middleware<Method, Params>[],
  context: RequestContext<Method, Params>,
  handler: RequestHandler<Method, Params, Response>,
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
