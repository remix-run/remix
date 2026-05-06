import type { Router } from './router.ts'

import type { Simplify } from './type-utils.ts'

/**
 * Create a request context key with an optional default value.
 *
 * @param defaultValue The default value for the context key
 * @returns The new context key
 */
export function createContextKey<value>(): ContextKey<value>
export function createContextKey<value>(
  defaultValue: value,
): ContextKey<value> & { defaultValue: value }
export function createContextKey<value>(defaultValue?: value): ContextKey<value> {
  return arguments.length === 0 ? {} : { defaultValue }
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

/**
 * A broad params shape for APIs that cannot know an exact route pattern ahead of time.
 */
export type AnyParams = Record<string, string>

/**
 * A single request-context entry that associates a context key with its stored value type.
 */
export type ContextEntry<key extends object = object, value = unknown> = readonly [key, value]

/**
 * An ordered list of request-context entries. Later entries override earlier ones for the same key.
 */
export type ContextEntries = readonly ContextEntry[]

/**
 * Resolves the value type associated with a request-context key.
 */
export type ContextValue<key> =
  key extends ContextKey<infer value>
    ? value
    : key extends { prototype: infer instance }
      ? instance
      : never

type ContextDefaultValue<key> = key extends { defaultValue: infer value } ? value : never

type ContextFallbackValue<key> = [ContextDefaultValue<key>] extends [never]
  ? ContextValue<key> | undefined
  : ContextDefaultValue<key>

/**
 * Extracts the route params type from a {@link RequestContext}.
 */
export type ContextParams<context> =
  context extends RequestContext<infer params extends Record<string, any>, any> ? params : {}

type DuplicateParamNames<
  left extends Record<string, any>,
  right extends Record<string, any>,
> = Extract<keyof left, keyof right>

/**
 * Merges two params objects and fails with `never` when they define the same param name.
 */
export type MergeContextParams<
  left extends Record<string, any>,
  right extends Record<string, any>,
> = [DuplicateParamNames<left, right>] extends [never] ? Simplify<left & right> : never

/**
 * Replaces the params type of a {@link RequestContext} while preserving its existing context entries.
 */
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
> = entries extends readonly [...infer rest extends ContextEntries, infer last extends ContextEntry]
  ? [key] extends [last[0]]
    ? [last[0]] extends [key]
      ? last[1]
      : ResolveContextEntryValue<rest, key, fallback>
    : ResolveContextEntryValue<rest, key, fallback>
  : fallback

/**
 * Resolves the value type returned by `context.get(key)` for the given context and key.
 */
export type GetContextValue<context, key extends object> =
  context extends RequestContext<any, infer entries extends ContextEntries>
    ? ResolveContextEntryValue<entries, key, ContextFallbackValue<key>>
    : ContextFallbackValue<key>

/**
 * Appends context entries to an existing {@link RequestContext}.
 */
export type MergeContext<context, additions extends ContextEntries> =
  context extends RequestContext<
    infer params extends Record<string, any>,
    infer entries extends ContextEntries
  >
    ? RequestContext<params, [...entries, ...additions]>
    : never

/**
 * Replaces or adds the value type for a single context key in a {@link RequestContext}.
 */
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
    this.method = request.method.toUpperCase()
    this.params = {} as params
    this.request = request
    this.url = new URL(request.url)
  }

  #headers: Headers | undefined

  /**
   * A mutable copy of the request headers.
   */
  get headers(): Headers {
    return (this.#headers ??= new Headers(this.request.headers))
  }

  set headers(headers: Headers) {
    this.#headers = headers
  }

  /**
   * The request method. This may differ from `request.method` when using the `methodOverride`
   * middleware, which allows HTML forms to simulate RESTful API request methods like `PUT` and
   * `DELETE` using a hidden input field.
   */
  method: string

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
   * @returns The value for the given key, or `undefined` if the value is not available
   */
  get = <key extends object>(key: key): GetContextValue<RequestContext<params, entries>, key> => {
    if (!this.#contextMap.has(key)) {
      let contextKey = key as ContextKey<GetContextValue<RequestContext<params, entries>, key>>
      if (!Object.hasOwn(contextKey, 'defaultValue')) {
        return undefined as GetContextValue<RequestContext<params, entries>, key>
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
