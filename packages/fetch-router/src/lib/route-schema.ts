import { RoutePattern } from '@remix-run/route-pattern'
import type { Join } from '@remix-run/route-pattern'

export function createRoutes<const R extends RouteDefs>(routes: R): BuildRouteSchema<'/', R>
export function createRoutes<P extends string, const R extends RouteDefs>(
  base: P | RoutePattern<P>,
  routes: R,
): BuildRouteSchema<P, R>
export function createRoutes(optionsOrRoutes: any, routes?: RouteDefs): RouteSchema {
  let base: RoutePattern
  let routeDefs: RouteDefs
  if (typeof optionsOrRoutes === 'string' || optionsOrRoutes instanceof RoutePattern) {
    if (routes == null) {
      throw new Error('Missing route definitions')
    }

    base =
      optionsOrRoutes instanceof RoutePattern ? optionsOrRoutes : new RoutePattern(optionsOrRoutes)
    routeDefs = routes
  } else {
    base = new RoutePattern('/')
    routeDefs = optionsOrRoutes
  }

  return _createRoutes(base, routeDefs)
}

function _createRoutes<P extends string, R extends RouteDefs>(
  base: RoutePattern<P>,
  routeDefs: R,
): BuildRouteSchema<P, R> {
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

export interface RouteSchema {
  [K: string]: RoutePattern | RouteSchema
}

export type RouteDef = string | RoutePattern
export type RouteDefs = {
  [K: string]: RouteDef | RouteDefs
}

type BuildRouteSchema<P extends string = string, R extends RouteDefs = RouteDefs> = Simplify<
  BuildSchema<P, R>
>

type Simplify<T> = { [K in keyof T]: T[K] } & {}

// prettier-ignore
type BuildSchema<P extends string , R extends RouteDefs > = {
  [K in keyof R]: (
    R[K] extends RouteDef ? RoutePattern<Join<P, SourceOf<R[K]>>> :
    R[K] extends RouteDefs ? BuildRouteSchema<P, R[K]> :
    never
  )
}

// prettier-ignore
type SourceOf<T extends RouteDef> =
  T extends string ? T :
  T extends RoutePattern<infer S extends string> ? S :
  never
