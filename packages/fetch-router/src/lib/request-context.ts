import type { Router } from './router.ts'

import type { RequestMethod } from './request-methods.ts'
import type { Simplify } from './type-utils.ts'

/**
 * Create a request context key with an optional default value.
 *
 * @param defaultValue The default value for the context key
 * @returns The new context key
 */
export function createContextKey<value>(defaultValue?: value): ContextKey<value> {
  return { defaultValue }
}

/**
 * A type-safe key for storing and retrieving values from {@link RequestContext}.
 */
export interface ContextKey<value> {
  /**
   * The default value for this key if no value has been set.
   */
  defaultValue?: value
}

export type AnyParams = Record<string, string>

export type ContextEntry<key extends object = object, value = unknown> = readonly [
  key,
  value,
]

export type ContextEntries = readonly ContextEntry[]

export type ContextValue<key> =
  key extends ContextKey<infer value>
    ? value
    : key extends abstract new (...args: any[]) => infer instance
      ? instance
      : never

export type ContextParams<context> = context extends RequestContext<
  infer params extends Record<string, any>,
  any
>
  ? params
  : {}

type DuplicateParamNames<
  left extends Record<string, any>,
  right extends Record<string, any>,
> = Extract<keyof left, keyof right>

export type MergeContextParams<
  left extends Record<string, any>,
  right extends Record<string, any>,
> = [DuplicateParamNames<left, right>] extends [never] ? Simplify<left & right> : never

export type WithParams<context, params extends Record<string, any>> =
  context extends RequestContext<any, infer entries extends ContextEntries>
    ? MergeContextParams<ContextParams<context>, params> extends infer merged
      ? [merged] extends [never]
        ? never
        : RequestContext<Extract<merged, Record<string, any>>, entries>
      : never
    : RequestContext<params>

type ResolveContextEntryValue<
  entries extends ContextEntries,
  key extends object,
  fallback,
> = entries extends readonly [
  ...infer rest extends ContextEntries,
  infer last extends ContextEntry,
]
  ? [key] extends [last[0]]
    ? [last[0]] extends [key]
      ? last[1]
      : ResolveContextEntryValue<rest, key, fallback>
    : ResolveContextEntryValue<rest, key, fallback>
  : fallback

export type GetContextValue<context, key extends object> =
  context extends RequestContext<any, infer entries extends ContextEntries>
    ? ResolveContextEntryValue<entries, key, ContextValue<key>>
    : ContextValue<key>

export type MergeContext<context, additions extends ContextEntries> =
  context extends RequestContext<
    infer params extends Record<string, any>,
    infer entries extends ContextEntries
  >
    ? RequestContext<params, [...entries, ...additions]>
    : never

export type SetContextValue<context, key extends object, value> = MergeContext<
  context,
  [readonly [key, value]]
>

/**
 * A context object that contains information about the current request. Every request
 * handler or middleware in the lifecycle of a request receives the same context object.
 */
export class RequestContext<
  params extends Record<string, any> = {},
  entries extends ContextEntries = [],
> {
  /**
   * @param request The incoming request
   */
  constructor(request: Request) {
    this.headers = new Headers(request.headers)
    this.method = request.method.toUpperCase() as RequestMethod
    this.params = {} as params
    this.request = request
    this.url = new URL(request.url)
  }

  /**
   * The headers of the request.
   */
  headers: Headers

  /**
   * The request method. This may differ from `request.method` when using the `methodOverride`
   * middleware, which allows HTML forms to simulate RESTful API request methods like `PUT` and
   * `DELETE` using a hidden input field.
   */
  method: RequestMethod

  /**
   * Params that were parsed from the URL.
   */
  params: params

  /**
   * The original request that was dispatched to the router.
   *
   * Note: Various properties of the original request may not be available or may have been
   * modified by middleware. For example, the request's body may already have been consumed by the
   * `formData` middleware (available as `context.get(FormData)`), or its method may have been
   * overridden by the `methodOverride` middleware (available as `context.method`). You should
   * default to using properties of the `context` object instead of the original request.
   * However, the original request is made available in case you need it for some edge case.
   */
  request: Request

  #contextMap: Map<object, unknown> = new Map()

  /**
   * Get a value from request context.
   *
   * @param key The key to read
   * @returns The value for the given key
   */
  get = <key extends object>(key: key): GetContextValue<RequestContext<params, entries>, key> => {
    if (!this.#contextMap.has(key)) {
      let contextKey = key as ContextKey<GetContextValue<RequestContext<params, entries>, key>>
      if (contextKey.defaultValue === undefined) {
        throw new Error(`Missing default value in context for key ${key}`)
      }

      return contextKey.defaultValue as GetContextValue<RequestContext<params, entries>, key>
    }

    return this.#contextMap.get(key) as GetContextValue<RequestContext<params, entries>, key>
  }

  /**
   * Check whether a value exists in request context.
   *
   * @param key The key to check
   * @returns `true` if a value has been set for the key
   */
  has = <key extends object>(key: key): boolean => this.#contextMap.has(key)

  /**
   * Set a value in request context.
   *
   * @param key The key to write
   * @param value The value to write
   */
  set = <key extends object>(key: key, value: ContextValue<key>): void => {
    this.#contextMap.set(key, value)
  }

  #router?: Router<any>

  /**
   * The router handling this request.
   */
  get router(): Router<RequestContext<any, entries>> {
    if (this.#router == null) {
      throw new Error('No router found in request context.')
    }

    return this.#router as Router<RequestContext<any, entries>>
  }

  set router(router: Router<any>) {
    this.#router = router
  }

  /**
   * The URL of the current request.
   */
  url: URL
}
