import type { RequestHandler } from './controller.ts'
import { raceRequestAbort } from './request-abort.ts'
import type { ContextEntries, RequestContext } from './request-context.ts'
import type { RequestMethod } from './request-methods.ts'

type AnyMiddleware = Middleware<any, any, any>

/**
 * The type-level effect a middleware can apply to request context.
 */
export type MiddlewareContextTransform =
  | ContextEntries
  | (<context extends RequestContext<any, any>>(context: context) => RequestContext<any, any>)

type IdentityContextTransform = readonly []

type MiddlewareTransform<middleware> = middleware extends Middleware<any, any, infer transform>
  ? transform
  : IdentityContextTransform

/**
 * Applies a middleware context transform to a request-context type.
 */
export type ApplyContextTransform<currentContext extends RequestContext<any, any>, transform> =
  transform extends ContextEntries
    ? currentContext extends RequestContext<
        infer params extends Record<string, any>,
        infer entries extends ContextEntries
      >
      ? RequestContext<params, [...entries, ...transform]>
      : currentContext
    : transform extends {
          <inputContext extends currentContext>(context: inputContext): infer output
        }
      ? output extends RequestContext<any, any>
        ? output
        : currentContext
      : currentContext

/**
 * Applies the declared context effect of a single middleware to a request-context type.
 */
export type ApplyMiddleware<context extends RequestContext<any, any>, middleware> =
  ApplyContextTransform<context, MiddlewareTransform<middleware>>

/**
 * Applies an ordered middleware array to a request-context type from left to right.
 */
export type ApplyMiddlewareTuple<context extends RequestContext<any, any>, middleware> =
  middleware extends readonly AnyMiddleware[]
    ? number extends middleware['length']
      ? context
      : middleware extends readonly [infer first, ...infer rest]
        ? ApplyMiddlewareTuple<ApplyMiddleware<context, first>, rest>
        : context
    : context

/**
 * Resolves the request-context type produced by a router middleware array.
 */
export type MiddlewareContext<middleware extends readonly AnyMiddleware[]> = ApplyMiddlewareTuple<
  RequestContext,
  middleware
>

/**
 * A special kind of request handler that either returns a response or passes control
 * to the next middleware or request handler in the chain.
 *
 * @param context The request context
 * @param next A function that invokes the next middleware or request handler in the chain
 * @returns A response to short-circuit the chain, or `undefined`/`void` to continue
 */
export interface Middleware<
  method extends RequestMethod | 'ANY' = RequestMethod | 'ANY',
  params extends Record<string, any> = {},
  transform extends MiddlewareContextTransform = IdentityContextTransform,
> {
  /**
   * Handles a request and optionally delegates to the next middleware or handler.
   */
  (
    context: RequestContext<params>,
    next: NextFunction,
  ): Response | undefined | void | Promise<Response | undefined | void>

  /**
   * Type-only metadata that carries the middleware's declared context effect.
   */
  readonly '~contextTransform'?: transform | undefined
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
  middleware: Middleware<method, params, any>[],
  context: RequestContext<params>,
  handler: RequestHandler<method, params, any>,
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
