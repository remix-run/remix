import type { RoutePattern } from '@remix-run/route-pattern'

import { createRoutes } from './route-map.ts'
import type { BuildRouteMap } from './route-map.ts'

/**
 * Create a route map with `index` (`GET`) and `action` (`POST`) routes, suitable
 * for showing a standard HTML `<form>` and handling its submit action at the same
 * URL.
 *
 * @param pattern The route pattern to use for the form and its submit action
 */
export function createFormAction<P extends string>(
  pattern: P | RoutePattern<P>,
): BuildFormActionMap<P> {
  return createRoutes(pattern, {
    index: { method: 'GET', pattern: '/' },
    action: { method: 'POST', pattern: '/' },
  })
}

type BuildFormActionMap<P extends string> = BuildRouteMap<
  P,
  {
    index: { method: 'GET'; pattern: '/' }
    action: { method: 'POST'; pattern: '/' }
  }
>
