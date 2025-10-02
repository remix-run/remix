import { RoutePattern } from '@remix-run/route-pattern'
import type { HrefBuilderArgs, Join } from '@remix-run/route-pattern'

import type { RequestMethod } from './request-handler.ts'
import type { Simplify } from './type-utils.ts'

export interface RouteMap<T extends string = string> {
  [K: string]: Route<RequestMethod, T> | RouteMap<T>
}

export class Route<M extends RequestMethod = RequestMethod, P extends string = string> {
  readonly method: M | 'ANY'
  readonly pattern: RoutePattern<P>

  constructor(method: M | 'ANY', pattern: P | RoutePattern<P>) {
    this.method = method
    this.pattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern
  }

  href(...args: HrefBuilderArgs<P>): string {
    return this.pattern.href(...args)
  }
}

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
    ? buildRouteMap(
        typeof baseOrDefs === 'string' ? new RoutePattern(baseOrDefs) : baseOrDefs,
        defs!,
      )
    : buildRouteMap(new RoutePattern('/'), baseOrDefs)
}

function buildRouteMap<P extends string, R extends RouteDefs>(
  base: RoutePattern<P>,
  defs: R,
): BuildRouteMap<P, R> {
  let routes: any = {}

  for (let key in defs) {
    let def = defs[key]

    if (def instanceof Route) {
      routes[key] = new Route(def.method, base.join(def.pattern))
    } else if (typeof def === 'string' || def instanceof RoutePattern) {
      routes[key] = new Route('ANY', base.join(def))
    } else if (typeof def === 'object' && def != null && 'pattern' in def) {
      routes[key] = new Route((def as any).method ?? 'ANY', base.join((def as any).pattern))
    } else {
      routes[key] = buildRouteMap(base, def as any)
    }
  }

  return routes
}

// prettier-ignore
type BuildRouteMap<P extends string = string, R extends RouteDefs = RouteDefs> = Simplify<{
  [K in keyof R]: (
    R[K] extends Route<infer M extends RequestMethod, infer S extends string> ? Route<M, Join<P, S>> :
    R[K] extends RouteDef ? BuildRoute<P, R[K]> :
    R[K] extends RouteDefs ? BuildRouteMap<P, R[K]> :
    never
  )
}>

// prettier-ignore
type BuildRoute<P extends string, D extends RouteDef> = 
  D extends string ? Route<RequestMethod, Join<P, D>> :
  D extends RoutePattern<infer S extends string> ? Route<RequestMethod, Join<P, S>> :
  D extends { method: infer M, pattern: infer S } ? (
    S extends string ? Route<M extends RequestMethod ? M : RequestMethod, Join<P, S>> :
    S extends RoutePattern<infer S extends string> ? Route<M extends RequestMethod ? M : RequestMethod, Join<P, S>> :
    never
  ) :
  never

export interface RouteDefs {
  [K: string]: Route | RouteDef | RouteDefs
}

export type RouteDef<T extends string = string> =
  | T
  | RoutePattern<T>
  | { method?: RequestMethod; pattern: T | RoutePattern<T> }
