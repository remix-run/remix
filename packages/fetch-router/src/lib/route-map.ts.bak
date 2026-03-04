import { RoutePattern } from '@remix-run/route-pattern'
import type { HrefArgs, Join, RoutePatternMatch } from '@remix-run/route-pattern'

import type { RequestMethod } from './request-methods.ts'
import type { Simplify } from './type-utils.ts'

/**
 * A map of route names to `Route` objects or nested `RouteMap` objects.
 */
export interface RouteMap<pattern extends string = string> {
  [name: string]: Route<RequestMethod | 'ANY', pattern> | RouteMap<pattern>
}

/**
 * A route definition that includes a request method and pattern.
 */
export class Route<
  method extends RequestMethod | 'ANY' = RequestMethod | 'ANY',
  pattern extends string = string,
> {
  /**
   * The HTTP method this route matches.
   */
  readonly method: method | 'ANY'

  /**
   * The pattern this route matches.
   */
  readonly pattern: RoutePattern<pattern>

  /**
   * @param method The HTTP method this route matches
   * @param pattern The pattern this route matches
   */
  constructor(method: method | 'ANY', pattern: pattern | RoutePattern<pattern>) {
    this.method = method
    this.pattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern
  }

  /**
   * Build a URL href for this route using the given parameters.
   *
   * @param args The parameters to use for building the href
   * @returns The built URL href
   */
  href(...args: HrefArgs<pattern>): string {
    return this.pattern.href(...args)
  }

  /**
   * Match a URL against this route's pattern.
   *
   * @param url The URL to match
   * @returns The match result, or `null` if the URL doesn't match
   */
  match(url: string | URL): RoutePatternMatch<pattern> | null {
    return this.pattern.match(url)
  }
}

/**
 * Build a `Route` type from a request method and pattern.
 */
// prettier-ignore
export type BuildRoute<method extends RequestMethod | 'ANY', pattern extends string | RoutePattern> =
  pattern extends string ? Route<method, pattern> :
  pattern extends RoutePattern<infer source extends string> ? Route<method, source> :
  never

/**
 * Create a route map from a set of route definitions.
 *
 * @param defs The route definitions
 * @returns The route map
 */
export function createRoutes<const defs extends RouteDefs>(defs: defs): BuildRouteMap<'/', defs>
/**
 * Create a route map from a set of route definitions with a base pattern.
 *
 * @param base The base pattern for all routes
 * @param defs The route definitions
 * @returns The route map
 */
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
    defs[name] extends RouteDef ? BuildRouteWithBase<base, defs[name]> :
    defs[name] extends RouteDefs ? BuildRouteMap<base, defs[name]> :
    never
  )
}>

// prettier-ignore
type BuildRouteWithBase<base extends string, def extends RouteDef> =
  def extends string ? Route<'ANY', Join<base, def>> :
  def extends RoutePattern<infer pattern extends string> ? Route<'ANY', Join<base, pattern>> :
  def extends { method: infer method extends RequestMethod | 'ANY', pattern: infer pattern } ? (
    pattern extends string ? Route<method, Join<base, pattern>> :
    pattern extends RoutePattern<infer source extends string> ? Route<method, Join<base, source>> :
    never
  ) :
  never

/**
 * A map of route names to route definitions.
 */
export interface RouteDefs {
  [name: string]: Route | RouteDef | RouteDefs
}

/**
 * A route definition that can be a string pattern, `RoutePattern`, or an object with method and
 * pattern.
 */
export type RouteDef<source extends string = string> =
  | source
  | RoutePattern<source>
  | { method?: RequestMethod; pattern: source | RoutePattern<source> }
