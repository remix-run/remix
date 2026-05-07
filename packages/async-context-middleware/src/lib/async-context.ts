import { AsyncLocalStorage } from 'node:async_hooks'

import type { Middleware, RequestContext } from '@remix-run/fetch-router'

/**
 * Module-augmentation hook for narrowing {@link AsyncRequestContext} to the
 * specific `RequestContext` shape your app installs into the
 * {@link asyncContext} middleware. Augment with a `requestContext` property in
 * your project's types entry to opt in.
 *
 * @example
 * ```ts
 * declare module '@remix-run/async-context-middleware' {
 *   interface AsyncContextTypes {
 *     requestContext: WithAuth<MyRequestContext>
 *   }
 * }
 * ```
 */
export interface AsyncContextTypes {}

/**
 * Resolved type for the request context returned by {@link getContext}. By
 * default this is the framework's generic `RequestContext`; augment
 * {@link AsyncContextTypes} with a `requestContext` field in your project to
 * narrow it to your app's specific context shape.
 */
export type AsyncRequestContext = AsyncContextTypes extends {
  requestContext: infer context extends RequestContext<any, any>
}
  ? context
  : RequestContext

const storage = new AsyncLocalStorage<RequestContext<any, any>>()

/**
 * Middleware that stores the request context in `AsyncLocalStorage` so it is available
 * to all functions in the same async execution context.
 *
 * @returns A middleware function that stores the request context in `AsyncLocalStorage`
 */
export function asyncContext(): Middleware {
  return (context, next) => storage.run(context, next)
}

/**
 * Get the request context from `AsyncLocalStorage`.
 *
 * @returns The request context
 */
export function getContext(): AsyncRequestContext {
  let context = storage.getStore()

  if (context == null) {
    throw new Error('No request context found. Make sure the asyncContext middleware is installed.')
  }

  return context as AsyncRequestContext
}
