import type { RoutePattern } from '@remix-run/route-pattern'

import type { RequestMethod } from './request-methods.ts'
import { createRoutes } from './route-map.ts'
import type { BuildRouteMap } from './route-map.ts'

export interface FormActionOptions {
  /**
   * The method the `<form>` uses to submit the action.
   * Default is `POST`.
   */
  formMethod?: RequestMethod
  /**
   * Custom names to use for the `index` and `action` routes.
   */
  names?: {
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
  let formMethod = options?.formMethod ?? 'POST'
  let indexName = options?.names?.index ?? 'index'
  let actionName = options?.names?.action ?? 'action'

  return createRoutes(pattern, {
    [indexName]: { method: 'GET', pattern: '/' },
    [actionName]: { method: formMethod, pattern: '/' },
  }) as BuildFormActionMap<P, O>
}

// prettier-ignore
type BuildFormActionMap<P extends string, O extends FormActionOptions> = BuildRouteMap<
  P,
  {
    [
      K in O extends { names: { index: infer N extends string } } ? N : 'index'
    ]: {
      method: 'GET'
      pattern: '/'
    }
  } & {
    [
      K in O extends { names: { action: infer N extends string } } ? N : 'action'
    ]: {
      method: O extends { formMethod: infer M extends RequestMethod } ? M : 'POST'
      pattern: '/'
    }
  }
>
