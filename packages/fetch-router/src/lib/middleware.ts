import type { RequestHandler } from './controller.ts'
import { raceRequestAbort } from './request-abort.ts'
import type {
  ContextEntries,
  ContextEntry,
  ContextParams,
  ContextWithEntries,
  ContextWithEntry,
  GetContextValue,
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

type EntriesOf<transform> = transform extends ContextEntries
  ? transform[number]
  : transform extends ContextEntry
    ? transform
    : never

type PossibleEntryValue<key extends object, writes> = writes extends ContextEntry
  ? key extends writes['key']
    ? writes['value']
    : writes['key'] extends key
      ? writes['value']
      : never
  : never

type WidenContextEntries<context, entries extends ContextEntries, writes> = {
  [index in keyof entries]: Omit<entries[index], 'value'> & {
    // Installed properties read their key's latest value, even when a write omits `property`.
    value:
      | GetContextValue<context, entries[index]['key']>
      | PossibleEntryValue<entries[index]['key'], writes>
  }
}

type ContextWithOptionalTransforms<context extends RequestContext<any, any>, transform> = [
  transform,
] extends [ContextEntry | ContextEntries]
  ? [EntriesOf<transform>] extends [never]
    ? context
    : context extends RequestContext<infer params, infer entries>
      ? entries extends readonly []
        ? context
        : ContextWithEntries<
            RequestContext<params>,
            WidenContextEntries<context, entries, EntriesOf<transform>>
          >
      : context
  : RequestContext<ContextParams<context>>

type ApplyMiddlewareContext<
  middleware extends readonly AnyMiddleware[],
  context extends RequestContext<any, any>,
> = middleware extends readonly [
  infer first extends AnyMiddleware,
  ...infer rest extends readonly AnyMiddleware[],
]
  ? ApplyMiddlewareContext<rest, ContextWithTransform<context, TransformOf<first>>>
  : middleware extends readonly [
        ...infer init extends readonly AnyMiddleware[],
        infer last extends AnyMiddleware,
      ]
    ? ContextWithTransform<ApplyMiddlewareContext<init, context>, TransformOf<last>>
    : ContextWithOptionalTransforms<context, TransformOf<middleware[number]>>

/**
 * Resolves the request-context type produced by middleware.
 *
 * Conditional entries like `...(isDev ? [logger()] : [])` do not guarantee new properties, but
 * widen existing values they may overwrite. Later fixed entries override those possible values.
 * Opaque transforms in a rest segment discard context refinements. Broad middleware arrays retain
 * the explicitly supplied base context.
 */
export type MiddlewareContext<
  middleware extends readonly AnyMiddleware[],
  context extends RequestContext<any, any> = RequestContext,
> = AnyMiddleware[] extends middleware ? context : ApplyMiddlewareContext<middleware, context>

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

    throw new Error('Middleware must return a Response or call next()')
  }

  return dispatch(0)
}
