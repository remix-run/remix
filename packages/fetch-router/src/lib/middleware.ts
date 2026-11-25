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
): Promise<Response> {
  let signal = context.request.signal
  let index = -1
  let ownedAbortRace: AbortRace | undefined

  function race(promise: Promise<Response>): Promise<Response> {
    let abortRace = sharedAbortRace ?? (ownedAbortRace ??= new AbortRace(context.request))
    return abortRace.race(promise)
  }

  function dispatch(i: number): Response | Promise<Response> {
    if (i <= index) throw new Error('next() called multiple times')
    index = i

    if (signal.aborted) {
      throw signal.reason
    }

    let fn = middleware[i]
    if (!fn) {
      let result = handler(context)
      if (result instanceof Response) {
        if (signal.aborted) {
          cancelAbandonedResponse(result, signal.reason)
          throw signal.reason
        }
        return result
      }

      return race(Promise.resolve(result))
    }

    let nextPromise: Promise<Response> | undefined
    let next: NextFunction = () => {
      if (nextPromise !== undefined) {
        return Promise.reject(new Error('next() called multiple times'))
      }

      try {
        let result = dispatch(i + 1)
        nextPromise = result instanceof Promise ? result : Promise.resolve(result)
      } catch (error) {
        nextPromise = Promise.reject(error)
      }

      // Mark handled immediately so middleware that calls next() and later short-circuits
      // or throws cannot trigger an unhandled rejection
      nextPromise.then(undefined, noop)
      return nextPromise
    }

    let result = fn(context, next)

    if (result instanceof Response) {
      if (signal.aborted) {
        cancelAbandonedResponse(result, signal.reason)
        throw signal.reason
      }
      return result
    }

    // Direct passthrough (`return next()`): downstream already handles abort racing
    if (result === nextPromise && nextPromise !== undefined) {
      if (signal.aborted) {
        nextPromise.then((value) => cancelAbandonedResponse(value, signal.reason), noop)
        throw signal.reason
      }
      return nextPromise
    }

    if (
      result instanceof Promise ||
      (result != null && typeof (result as PromiseLike<Response>).then === 'function')
    ) {
      let promise = result instanceof Promise ? result : Promise.resolve(result)
      return race(promise).then((response) => {
        if (response instanceof Response) {
          return response
        }
        if (nextPromise !== undefined) {
          return nextPromise
        }
        throw new Error('Middleware must return a Response or call next()')
      })
    }

    if (signal.aborted) {
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
      ownedAbortRace?.dispose()
      return Promise.resolve(result)
    }

    if (ownedAbortRace !== undefined) {
      let cleanup = () => ownedAbortRace!.dispose()
      result.then(cleanup, cleanup)
    }
    return result
  } catch (error) {
    ownedAbortRace?.dispose()
    return Promise.reject(error)
  }
}
