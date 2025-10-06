import type { RequestContext } from './request-context.ts'
import type { RequestHandler } from './request-handler.ts'

/**
 * A special kind of request handler that either returns a response or passes control
 * to the next middleware or request handler in the chain.
 */
export interface Middleware<Params extends Record<string, any> = {}> {
  (
    context: RequestContext<Params>,
    next: NextFunction,
  ): Response | undefined | void | Promise<Response | undefined | void>
}

export type NextFunction = (moreContext?: Partial<RequestContext>) => Promise<Response>

export function runMiddleware<Params extends Record<string, any>>(
  middleware: Middleware<Params>[],
  context: RequestContext<Params>,
  handler: RequestHandler<Params, Response>,
): Promise<Response> {
  let index = -1

  let dispatch = async (i: number): Promise<Response> => {
    if (i <= index) throw new Error('next() called multiple times')
    index = i

    let fn = middleware[i]
    if (!fn) return handler(context)

    let nextPromise: Promise<Response> | undefined
    let next: NextFunction = (moreContext?: Partial<RequestContext>) => {
      if (moreContext != null) {
        Object.assign(context, moreContext)
      }

      nextPromise = dispatch(i + 1)
      return nextPromise
    }

    let response = await fn(context, next)

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
