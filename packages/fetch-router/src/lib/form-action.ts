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
export function createFormAction<pattern extends string, const options extends FormActionOptions>(
  pattern: pattern | RoutePattern<pattern>,
  options?: options,
): BuildFormActionMap<pattern, options> {
  let formMethod = options?.formMethod ?? 'POST'
  let indexName = options?.names?.index ?? 'index'
  let actionName = options?.names?.action ?? 'action'

  return createRoutes(pattern, {
    [indexName]: { method: 'GET', pattern: '/' },
    [actionName]: { method: formMethod, pattern: '/' },
  }) as BuildFormActionMap<pattern, options>
}

// prettier-ignore
type BuildFormActionMap<pattern extends string, options extends FormActionOptions> = BuildRouteMap<
  pattern,
  {
    [
      key in options extends { names: { index: infer indexName extends string } } ? indexName : 'index'
    ]: {
      method: 'GET'
      pattern: '/'
    }
  } & {
    [
      key in options extends { names: { action: infer actionName extends string } } ? actionName : 'action'
    ]: {
      method: options extends { formMethod: infer formMethod extends RequestMethod } ? formMethod : 'POST'
      pattern: '/'
    }
  }
>
