import type { Middleware } from '@remix-run/fetch-router'
import { requestContext } from '../utils/context.ts'

/**
 * Middleware that stores the RequestContext in AsyncLocalStorage.
 * This should be the first middleware in your application so that
 * the context is available to all subsequent middleware and handlers.
 */
export let storeContext: Middleware = (context, next) => {
  return requestContext.run(context, () => next())
}
