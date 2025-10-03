import { AppStorage } from './app-storage.ts'

export type AnyMethod = 'ANY'

export type RequestMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'

// prettier-ignore
export const RequestMethods: RequestMethod[] = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']

/**
 * A request handler function that returns some kind of response.
 */
export interface RequestHandler<P extends AnyParams = {}, T = Response> {
  (context: RequestContext<P>): T | Promise<T>
}

/**
 * A special kind of request handler that either returns a response or passes control
 * to the next middleware or request handler in the chain.
 */
export interface Middleware<P extends AnyParams = {}> {
  (
    context: RequestContext<P>,
    next: NextFunction,
  ): Response | undefined | void | Promise<Response | undefined | void>
}

export type NextFunction = () => Promise<Response>

export function runMiddleware<P extends AnyParams>(
  middleware: Middleware<P>[],
  context: RequestContext<P>,
  handler: RequestHandler<P, Response>,
): Promise<Response> {
  let index = -1

  let dispatch = async (i: number): Promise<Response> => {
    if (i <= index) throw new Error('next() called multiple times')
    index = i

    let fn = middleware[i]
    if (!fn) return handler(context)

    let nextPromise: Promise<Response> | undefined
    let next: NextFunction = () => {
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

/**
 * A context object that contains information about the current request. Every request
 * handler or middleware in the lifecycle of a request receives the same context object.
 */
export class RequestContext<P extends AnyParams = {}> {
  /**
   * The original request that was dispatched to the router.
   */
  readonly request: Request
  /**
   * The URL that was matched by the route.
   *
   * Note: This may be different from the original request URL if the request was routed to a
   * downstream router.
   */
  readonly url: URL
  /**
   * Params that were parsed from the URL.
   */
  readonly params: P
  /**
   * Shared application-specific storage.
   */
  readonly storage: AppStorage

  constructor(request: Request, url: URL, params: P = {} as P, storage = new AppStorage()) {
    this.request = request
    this.url = url
    this.params = params
    this.storage = storage
  }
}

type AnyParams = Record<string, any>
