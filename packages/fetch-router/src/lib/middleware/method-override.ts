import type { Middleware } from '../middleware.ts'
import type { RequestContext } from '../request-context.ts'
import { type RequestMethod, RequestMethods } from '../request-methods.ts'

export interface MethodOverrideOptions {
  /**
   * The name of the form field to check for request method override.
   * Default is `_method`.
   */
  fieldName?: string
}

/**
 * Middleware that overrides `context.method` with the value of the method override field.
 *
 * Note: This middleware must be placed after the `formData` middleware in the middleware chain, or
 * some other middleware that provides `context.formData`.
 *
 * @param options (optional) Options for the method override middleware
 * @returns A middleware that overrides `context.method` with the value of the method override field
 */
export function methodOverride(options?: MethodOverrideOptions): Middleware {
  let fieldName = options?.fieldName ?? '_method'

  return async (context: RequestContext) => {
    let formData = context.formData
    if (formData == null) {
      return
    }

    let method = formData.get(fieldName)
    if (typeof method !== 'string') {
      return
    }

    let requestMethod = method.toUpperCase() as RequestMethod

    if (RequestMethods.includes(requestMethod)) {
      context.method = requestMethod
    }
  }
}
