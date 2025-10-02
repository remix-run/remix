import { RoutePattern } from '@remix-run/route-pattern'
import type { Join } from '@remix-run/route-pattern'

import type { Simplify } from './type-utils.ts'

/**
 * Create a route map from a set of route definitions.
 */
export function createRoutes<const R extends RouteDefs>(defs: R): BuildRouteMap<'/', R>
export function createRoutes<P extends string, const R extends RouteDefs>(
  base: P | RoutePattern<P>,
  defs: R,
): BuildRouteMap<P, R>
export function createRoutes(baseOrDefs: any, defs?: RouteDefs): RouteMap {
  return typeof baseOrDefs === 'string' || baseOrDefs instanceof RoutePattern
    ? _createRoutes(
        typeof baseOrDefs === 'string' ? new RoutePattern(baseOrDefs) : baseOrDefs,
        defs!,
      )
    : _createRoutes(new RoutePattern('/'), baseOrDefs)
}

function _createRoutes<P extends string, R extends RouteDefs>(
  base: RoutePattern<P>,
  defs: R,
): BuildRouteMap<P, R> {
  let routes: any = {}

  for (let key in defs) {
    let def = defs[key]
    if (typeof def === 'string' || def instanceof RoutePattern) {
      routes[key] = base.join(def)
    } else if (typeof def === 'object' && def !== null) {
      routes[key] = _createRoutes(base, def)
    }
  }

  return routes
}

// prettier-ignore
type BuildRouteMap<P extends string = string, R extends RouteDefs = RouteDefs> = Simplify<{
  [K in keyof R]: (
    R[K] extends RouteDef<infer S extends string> ? RoutePattern<Join<P, S>> :
    R[K] extends RouteDefs ? BuildRouteMap<P, R[K]> :
    never
  )
}>

export interface RouteMap<T extends string = string> {
  [K: string]: RoutePattern<T> | RouteMap<T>
}

export interface RouteDefs {
  [K: string]: RouteDef | RouteDefs
}

export type RouteDef<T extends string = string> = T | RoutePattern<T>
