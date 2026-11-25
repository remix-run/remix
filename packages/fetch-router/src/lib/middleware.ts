import type { RequestHandler } from './controller.ts'
import { AbortRace, cancelAbandonedResponse } from './request-abort.ts'
import type {
  ContextEntries,
  ContextEntry,
  ContextWithEntries,
  ContextWithEntry,
  RequestContext,
} from './request-context.ts'

/**
 * A middleware of any context transform.
 */
export type AnyMiddleware = Middleware<ContextTransform>

type ContextTransform =
  | ContextEntry
  | ContextEntries
  | (<context extends RequestContext<any, any>>(context: context) => RequestContext<any, any>)

type EmptyContextTransform = readonly []

declare const contextTransform: unique symbol

type TransformOf<middleware> =
  middleware extends Middleware<infer transform> ? transform : EmptyContextTransform

type ContextWithTransform<
  context extends RequestContext<any, any>,
  transform,
> = transform extends ContextEntries
  ? ContextWithEntries<context, transform>
  : transform extends ContextEntry
    ? ContextWithEntry<context, transform>
    : transform extends {
          <inputContext extends context>(context: inputContext): infer output
        }
      ? output extends RequestContext<any, any>
        ? output
        : context
      : context

/**
 * Resolves the request-context type produced by a middleware tuple.
 *
 * Conditional entries like `...(isDev ? [logger()] : [])` may not run, so their values are not
 * added to the context. Plain arrays, which have no known order, resolve to the base context.
 */
export type MiddlewareContext<
  middleware extends readonly AnyMiddleware[],
  context extends RequestContext<any, any> = RequestContext,
> = middleware extends readonly [
  infer first extends AnyMiddleware,
  ...infer rest extends readonly AnyMiddleware[],
]
  ? MiddlewareContext<rest, ContextWithTransform<context, TransformOf<first>>>
  : middleware extends readonly [
        ...infer init extends readonly AnyMiddleware[],
        infer last extends AnyMiddleware,
      ]
    ? ContextWithTransform<MiddlewareContext<init, context>, TransformOf<last>>
    : context

/**
 * A special kind of request handler that either returns a response or passes control
 * to the next middleware or request handler in the chain.
 *
 * @param context The request context
 * @param next A function that invokes the next middleware or request handler in the chain
 * @returns A response to short-circuit the chain, or the response from `next()` to continue
 *
 * The generic describes the context effect this middleware has. Use a `{ key, value }` object for
 * middleware that provides one context value, add a `property` field to install a direct context
 * property, or use {@link ContextEntries} for multiple values.
 */
export type Middleware<transform extends ContextTransform = EmptyContextTransform> = ((
  context: RequestContext<any>,
  next: NextFunction,
) => Response | Promise<Response>) & {
  /**
   * Type-only metadata that carries the middleware's declared context effect.
   */
  readonly [contextTransform]?: transform | undefined
}

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
export function createMiddleware<const middleware extends readonly AnyMiddleware[]>(
  ...middleware: middleware
): middleware {
  return middleware
}

/**
 * A function that invokes the next middleware or handler in the chain.
 *
 * @returns The response from the downstream handler
 */
export type NextFunction = () => Promise<Response>

const noop = () => {}

export function runMiddleware(
  middleware: AnyMiddleware[],
  context: RequestContext<any, any>,
  handler: RequestHandler<any>,
  sharedAbortRace?: AbortRace,
  canAbort = true,
): Promise<Response> {
  let request = context.request
  let signal = canAbort ? request.signal : undefined
  let len = middleware.length
  let index = -1
  let ownedAbortRace: AbortRace | undefined

  function getAbortRace(): AbortRace {
    if (sharedAbortRace !== undefined) return sharedAbortRace
    return (ownedAbortRace ??= new AbortRace(request))
  }

  function dispatch(i: number): Response | Promise<Response> {
    if (i <= index) throw new Error('next() called multiple times')
    index = i

    if (signal !== undefined && signal.aborted) {
      throw signal.reason
    }

    if (i === len) {
      let result = handler(context)

      if (result instanceof Response) {
        if (signal !== undefined && signal.aborted) {
          cancelAbandonedResponse(result, signal.reason)
          throw signal.reason
        }

        return result
      }

      if (result instanceof Promise) {
        return canAbort ? getAbortRace().race(result) : result
      }

      if (result != null && typeof (result as PromiseLike<Response>).then === 'function') {
        let promise = Promise.resolve(result)
        return canAbort ? getAbortRace().race(promise) : promise
      }

      return result
    }

    let fn = middleware[i]
    let nextPromise: Promise<Response> | undefined
    let nextCanReject = false
    let next: NextFunction = () => {
      if (nextPromise !== undefined) {
        return Promise.reject(new Error('next() called multiple times'))
      }

      try {
        let result = dispatch(i + 1)
        if (result instanceof Promise) {
          nextCanReject = true
          nextPromise = result
        } else {
          nextPromise = Promise.resolve(result)
        }
      } catch (error) {
        nextCanReject = true
        nextPromise = Promise.reject(error)
      }

      return nextPromise
    }

    let result: Response | Promise<Response>
    try {
      result = fn(context, next)
    } catch (error) {
      if (nextCanReject) nextPromise!.then(undefined, noop)
      throw error
    }

    // Synchronous short-circuit response
    if (result instanceof Response) {
      if (nextCanReject) nextPromise!.then(undefined, noop)

      if (signal !== undefined && signal.aborted) {
        cancelAbandonedResponse(result, signal.reason)
        throw signal.reason
      }

      return result
    }

    // Direct passthrough (`return next()`): downstream already handles abort racing
    if (result === nextPromise && nextPromise !== undefined) {
      return nextPromise
    }

    let isNativePromise = result instanceof Promise
    if (
      isNativePromise ||
      (result != null && typeof (result as PromiseLike<Response>).then === 'function')
    ) {
      let promise = isNativePromise ? result : Promise.resolve(result)

      if (!canAbort) {
        return promise.then(
          (response) => {
            if (response instanceof Response) {
              if (nextCanReject) nextPromise!.then(undefined, noop)
              return response
            }
            if (nextPromise !== undefined) {
              return nextPromise
            }
            throw new Error('Middleware must return a Response or call next()')
          },
          (error) => {
            if (nextCanReject) nextPromise!.then(undefined, noop)
            throw error
          },
        )
      }

      if (signal!.aborted) {
        if (nextCanReject) nextPromise!.then(undefined, noop)
        promise.then((value) => cancelAbandonedResponse(value, signal!.reason), noop)
        return Promise.reject(signal!.reason)
      }

      let abortRace = getAbortRace()

      return new Promise<Response>((resolve, reject) => {
        abortRace.addRejector(reject)

        promise.then(
          (response) => {
            abortRace.removeRejector(reject)

            if (signal!.aborted) {
              if (nextCanReject) nextPromise!.then(undefined, noop)
              cancelAbandonedResponse(response, signal!.reason)
              return
            }

            if (response instanceof Response) {
              if (nextCanReject) nextPromise!.then(undefined, noop)
              resolve(response)
            } else if (nextPromise !== undefined) {
              resolve(nextPromise)
            } else {
              reject(new Error('Middleware must return a Response or call next()'))
            }
          },
          (error) => {
            abortRace.removeRejector(reject)
            if (nextCanReject) nextPromise!.then(undefined, noop)
            reject(error)
          },
        )
      })
    }

    if (signal !== undefined && signal.aborted) {
      if (nextCanReject) nextPromise!.then(undefined, noop)
      throw signal.reason
    }

    if (nextPromise !== undefined) {
      return nextPromise
    }

    throw new Error('Middleware must return a Response or call next()')
  }

  try {
    let result = dispatch(0)

    if (!(result instanceof Promise)) {
      return Promise.resolve(result)
    }

    if (ownedAbortRace === undefined) {
      return result
    }

    let cleanup = () => ownedAbortRace!.dispose()
    result.then(cleanup, cleanup)
    return result
  } catch (error) {
    ownedAbortRace?.dispose()
    return Promise.reject(error)
  }
}
