import type { Join } from './join.ts'
import { RoutePattern } from './route-pattern.ts'
import type { Simplify } from './type-utils.ts'

/**
 * Create a route map from a set of route definitions.
 *
 * @param routes Route definitions
 */
export function createRoutes<const R extends RouteDefs>(routes: R): BuildRouteMap<'/', R>
export function createRoutes<P extends string, const R extends RouteDefs>(
  base: P | RoutePattern<P>,
  routes: R,
): BuildRouteMap<P, R>
export function createRoutes(baseOrRoutes: any, routes?: RouteDefs): RouteMap {
  let base: RoutePattern
  let routeDefs: RouteDefs
  if (typeof baseOrRoutes === 'string' || baseOrRoutes instanceof RoutePattern) {
    if (routes == null) {
      throw new Error('Missing route definitions')
    }

    base = typeof baseOrRoutes === 'string' ? new RoutePattern(baseOrRoutes) : baseOrRoutes
    routeDefs = routes
  } else {
    base = new RoutePattern('/')
    routeDefs = baseOrRoutes
  }

  return _createRoutes(base, routeDefs)
}

function _createRoutes<P extends string, R extends RouteDefs>(
  base: RoutePattern<P>,
  routeDefs: R,
): BuildRouteMap<P, R> {
  let routes: any = {}

  for (let key in routeDefs) {
    let def = routeDefs[key]
    if (typeof def === 'string' || def instanceof RoutePattern) {
      routes[key] = base.join(def)
    } else if (typeof def === 'object' && def !== null) {
      routes[key] = _createRoutes(base, def)
    }
  }

  return routes
}

export interface RouteMap<T extends string = string> {
  [K: string]: RoutePattern<T> | RouteMap<T>
}

export type RouteDef = string | RoutePattern
export type RouteDefs = {
  [K: string]: RouteDef | RouteDefs
}

type BuildRouteMap<P extends string = string, R extends RouteDefs = RouteDefs> = Simplify<
  BuildMap<P, R>
>

// prettier-ignore
type BuildMap<P extends string , R extends RouteDefs > = {
  [K in keyof R]: (
    R[K] extends RouteDef ? RoutePattern<Join<P, SourceOf<R[K]>>> :
    R[K] extends RouteDefs ? BuildRouteMap<P, R[K]> :
    never
  )
}

// prettier-ignore
type SourceOf<T extends RouteDef> =
  T extends string ? T :
  T extends RoutePattern<infer S extends string> ? S :
  never
