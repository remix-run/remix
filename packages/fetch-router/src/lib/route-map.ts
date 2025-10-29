import { RoutePattern } from '@remix-run/route-pattern'
import type { HrefBuilderArgs, Join, RouteMatch } from '@remix-run/route-pattern'

import type { RequestMethod } from './request-methods.ts'
import type { Simplify } from './type-utils.ts'

export interface RouteMap<name extends string = string> {
  [name: string]: Route<RequestMethod | 'ANY', name> | RouteMap<name>
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
export function createRoutes<pattern extends string, const defs extends RouteDefs>(
  base: pattern | RoutePattern<pattern>,
  defs: defs,
): BuildRouteMap<pattern, defs>
export function createRoutes(baseOrDefs: any, defs?: RouteDefs): RouteMap {
  return typeof baseOrDefs === 'string' || baseOrDefs instanceof RoutePattern
    ? buildRouteMap(
        typeof baseOrDefs === 'string' ? new RoutePattern(baseOrDefs) : baseOrDefs,
        defs!,
      )
    : buildRouteMap(new RoutePattern('/'), baseOrDefs)
}

function buildRouteMap<pattern extends string, defs extends RouteDefs>(
  base: RoutePattern<pattern>,
  defs: defs,
): BuildRouteMap<pattern, defs> {
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
export type BuildRouteMap<basePattern extends string, defs extends RouteDefs> = Simplify<{
  -readonly [name in keyof defs]: (
    defs[name] extends Route<infer method extends RequestMethod | 'ANY', infer pattern extends string> ? Route<method, Join<basePattern, pattern>> :
    defs[name] extends RouteDef ? BuildRoute<basePattern, defs[name]> :
    defs[name] extends RouteDefs ? BuildRouteMap<basePattern, defs[name]> :
    never
  )
}>

// prettier-ignore
type BuildRoute<basePattern extends string, def extends RouteDef> = 
  def extends string ? Route<'ANY', Join<basePattern, def>> :
  def extends RoutePattern<infer pattern extends string> ? Route<'ANY', Join<basePattern, pattern>> :
  def extends { method: infer method, pattern: infer pattern } ? (
    pattern extends string ? Route<method extends RequestMethod ? method : 'ANY', Join<basePattern, pattern>> :
    pattern extends RoutePattern<infer pattern extends string> ? Route<method extends RequestMethod ? method : 'ANY', Join<basePattern, pattern>> :
    never
  ) :
  never

export interface RouteDefs {
  [name: string]: Route | RouteDef | RouteDefs
}

export type RouteDef<pattern extends string = string> =
  | pattern
  | RoutePattern<pattern>
  | { method?: RequestMethod; pattern: pattern | RoutePattern<pattern> }
