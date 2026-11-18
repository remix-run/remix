import { getContext } from 'remix/middleware/async-context'
import type { Middleware } from 'remix/router'

import { ErrorPage } from '../actions/error-pages.tsx'

/**
 * Middleware that renders the branded error page when a downstream action or middleware throws.
 * Must be used after render() so it can render the page. Errors from earlier middleware and from
 * rendering the page shell escape to the server's `onError` handler.
 */
export function errorPage(): Middleware {
  return async (context, next) => {
    try {
      return await next()
    } catch (error) {
      if (context.request.signal.aborted) throw error

      console.error(error)
      return getContext().render(<ErrorPage />, { status: 500 })
    }
  }
}
