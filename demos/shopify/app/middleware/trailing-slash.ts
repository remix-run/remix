import { redirect } from 'remix/response/redirect'
import type { Middleware } from 'remix/router'

/**
 * Redirects page requests with trailing slashes to the canonical URL without them.
 */
export function dropTrailingSlash(): Middleware {
  return ({ method, url }, next) => {
    if ((method !== 'GET' && method !== 'HEAD') || url.pathname === '/') return next()

    let pathname = url.pathname.replace(/\/+$/, '')
    if (pathname === url.pathname) return next()

    return redirect(`${pathname || '/'}${url.search}`, 301)
  }
}
