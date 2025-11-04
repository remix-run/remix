import { RoutePattern } from '@remix-run/route-pattern'
import type { HrefBuilderArgs, Join, RouteMatch } from '@remix-run/route-pattern'

import type { RequestMethod } from './request-methods.ts'
import type { Simplify } from './type-utils.ts'

export interface RouteMap<pattern extends string = string> {
  [name: string]: Route<RequestMethod | 'ANY', pattern> | RouteMap<pattern>
}

export class Route<
  method extends RequestMethod | 'ANY' = RequestMethod | 'ANY',
  pattern extends string = string,
> {
  readonly method: method | 'ANY'
  readonly pattern: RoutePattern<pattern>

  constructor(method: method | 'ANY', pattern: pattern | RoutePattern<pattern>) {
    this.method = method
    this.pattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern
  }

  href(...args: HrefBuilderArgs<pattern>): string {
    return this.pattern.href(...args)
  }

  match(url: string | URL): RouteMatch<pattern> | null {
    return this.pattern.match(url)
  }
}

/**
 * Create a route map from a set of route definitions.
 */
export function createRoutes<const defs extends RouteDefs>(defs: defs): BuildRouteMap<'/', defs>
export function createRoutes<base extends string, const defs extends RouteDefs>(
  base: base | RoutePattern<base>,
  defs: defs,
): BuildRouteMap<base, defs>
export function createRoutes(baseOrDefs: any, defs?: RouteDefs): RouteMap {
  return typeof baseOrDefs === 'string' || baseOrDefs instanceof RoutePattern
    ? buildRouteMap(
        typeof baseOrDefs === 'string' ? new RoutePattern(baseOrDefs) : baseOrDefs,
        defs!,
      )
    : buildRouteMap(new RoutePattern('/'), baseOrDefs)
}

function buildRouteMap<base extends string, defs extends RouteDefs>(
  base: RoutePattern<base>,
  defs: defs,
): BuildRouteMap<base, defs> {
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
export type BuildRouteMap<base extends string, defs extends RouteDefs> = Simplify<{
  -readonly [name in keyof defs]: (
    defs[name] extends Route<infer method extends RequestMethod | 'ANY', infer pattern extends string> ? Route<method, Join<base, pattern>> :
    defs[name] extends RouteDef ? BuildRoute<base, defs[name]> :
    defs[name] extends RouteDefs ? BuildRouteMap<base, defs[name]> :
    never
  )
}>

// prettier-ignore
type BuildRoute<base extends string, defs extends RouteDef> = 
  defs extends string ? Route<'ANY', Join<base, defs>> :
  defs extends RoutePattern<infer pattern extends string> ? Route<'ANY', Join<base, pattern>> :
  defs extends { method: infer method extends RequestMethod | 'ANY', pattern: infer pattern } ? (
    pattern extends string ? Route<method, Join<base, pattern>> :
    pattern extends RoutePattern<infer source extends string> ? Route<method, Join<base, source>> :
    never
  ) :
  never

export interface RouteDefs {
  [name: string]: Route | RouteDef | RouteDefs
}

export type RouteDef<source extends string = string> =
  | source
  | RoutePattern<source>
  | { method?: RequestMethod; pattern: source | RoutePattern<source> }
