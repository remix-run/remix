import type { RequestHandler } from './controller.ts'
import { raceRequestAbort } from './request-abort.ts'
import type {
  ContextEntries,
  ContextEntry,
  ContextWithValues,
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
  ? ContextWithValues<context, transform>
  : transform extends ContextEntry
    ? ContextWithValues<context, [transform]>
    : transform extends {
          <inputContext extends context>(context: inputContext): infer output
        }
      ? output extends RequestContext<any, any>
        ? output
        : context
      : context

/**
 * Resolves the request-context type produced by a middleware array.
 */
export type MiddlewareContext<
  middleware extends readonly AnyMiddleware[],
  context extends RequestContext<any, any> = RequestContext,
> = number extends middleware['length']
  ? context
  : middleware extends readonly [
        infer first extends AnyMiddleware,
        ...infer rest extends readonly AnyMiddleware[],
      ]
    ? MiddlewareContext<rest, ContextWithTransform<context, TransformOf<first>>>
    : context

/**
 * Resolves the request-context type produced by applying middleware to an existing context.
 *
 * This is useful for router helpers and third-party libraries that need to describe
 * the context available after a known middleware tuple runs.
 */
export type ContextWithMiddleware<
  context extends RequestContext<any, any>,
  middleware extends readonly AnyMiddleware[],
> = MiddlewareContext<middleware, context>

/**
 * A special kind of request handler that either returns a response or passes control
 * to the next middleware or request handler in the chain.
 *
 * @param context The request context
 * @param next A function that invokes the next middleware or request handler in the chain
 * @returns A response to short-circuit the chain, or `undefined`/`void` to continue
 *
 * The generic describes the context effect this middleware has. Use a {@link ContextEntry}
 * for middleware that provides one context value, or {@link ContextEntries} for multiple values.
 */
export interface Middleware<transform extends ContextTransform = EmptyContextTransform> {
  /**
   * Handles a request and optionally delegates to the next middleware or handler.
   */
  (
    context: RequestContext<any>,
    next: NextFunction,
  ): Response | undefined | void | Promise<Response | undefined | void>

  /**
   * Type-only metadata that carries the middleware's declared context effect.
   */
  readonly [contextTransform]?: transform | undefined
}

/**
 * A function that invokes the next middleware or handler in the chain.
 *
 * @returns The response from the downstream handler
 */
export type NextFunction = () => Promise<Response>

export function runMiddleware(
  middleware: AnyMiddleware[],
  context: RequestContext<any, any>,
  handler: RequestHandler<any>,
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
