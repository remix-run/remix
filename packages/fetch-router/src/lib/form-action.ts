import type { RoutePattern } from '@remix-run/route-pattern'

import type { RequestMethod } from './request-methods.ts'
import { createRoutes } from './route-map.ts'
import type { BuildRouteMap } from './route-map.ts'

export interface FormActionOptions {
  /**
   * The method the `<form>` uses to submit to the action route.
   * Default is `POST`.
   */
  submitMethod?: RequestMethod
  /**
   * Custom names to use for the `index` and `action` routes.
   */
  routeNames?: {
    index?: string
    action?: string
  }
}

/**
 * Create a route map with `index` (`GET`) and `action` (`POST`) routes, suitable
 * for showing a standard HTML `<form>` and handling its submit action at the same
 * URL.
 *
 * @param pattern The route pattern to use for the form and its submit action
 */
export function createFormAction<P extends string, const O extends FormActionOptions>(
  pattern: P | RoutePattern<P>,
  options?: O,
): BuildFormActionMap<P, O> {
  let submitMethod = options?.submitMethod ?? 'POST'
  let indexName = options?.routeNames?.index ?? 'index'
  let actionName = options?.routeNames?.action ?? 'action'

  return createRoutes(pattern, {
    [indexName]: { method: 'GET', pattern: '/' },
    [actionName]: { method: submitMethod, pattern: '/' },
  }) as BuildFormActionMap<P, O>
}

// prettier-ignore
type BuildFormActionMap<P extends string, O extends FormActionOptions> = BuildRouteMap<
  P,
  {
    [
      K in O extends { routeNames: { index: infer I } }
        ? I extends string
          ? I
          : 'index'
        : 'index'
    ]: {
      method: 'GET'
      pattern: '/'
    }
  } & {
    [
      K in O extends { routeNames: { action: infer A } }
        ? A extends string
          ? A
          : 'action'
        : 'action'
    ]: {
      method: O extends { submitMethod: infer M } ? M : 'POST'
      pattern: '/'
    }
  }
>
