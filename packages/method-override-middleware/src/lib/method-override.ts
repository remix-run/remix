import { RequestMethods } from '@remix-run/fetch-router'
import type { Middleware, RequestContext, RequestMethod } from '@remix-run/fetch-router'

/**
 * Options for the `methodOverride` middleware.
 */
export interface MethodOverrideOptions {
  /**
   * The name of the form field to check for request method override.
   *
   * @default '_method'
   */
  fieldName?: string
}

/**
 * Middleware that overrides `context.method` with the value of the method override field.
 *
 * Note: This middleware must be placed after the `formData` middleware in the middleware chain, or
 * some other middleware that provides `context.formData`.
 *
 * @param options Options for the method override middleware
 * @returns A middleware that overrides `context.method` with the value of the method override field
 */
export function methodOverride(options?: MethodOverrideOptions): Middleware {
  let fieldName = options?.fieldName ?? '_method'

  return (context: RequestContext) => {
    let method = context.formData?.get(fieldName)
    if (typeof method !== 'string') {
      return
    }

    let requestMethod = method.toUpperCase() as RequestMethod

    if (RequestMethods.includes(requestMethod)) {
      context.method = requestMethod
    }
  }
}
