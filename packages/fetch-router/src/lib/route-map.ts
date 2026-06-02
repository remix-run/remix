import type { RoutePattern } from '@remix-run/route-pattern'
import type { CreateHrefArgs } from '@remix-run/route-pattern/href'
import { createHref } from '@remix-run/route-pattern/href'
import type { JoinPatterns } from '@remix-run/route-pattern/join'
import { parsePatternParts } from '@remix-run/route-pattern/parse'
import type {
  ParsedRoutePattern,
  PartPattern,
  PartPatternToken,
} from '@remix-run/route-pattern/parse'

import type { RequestMethod } from './request-methods.ts'
import type { Simplify } from './type-utils.ts'

/**
 * A map of route names to {@link Route} objects or nested route maps.
 */
export interface RouteMap<pattern extends string = string> {
  /**
   * Named route or nested route map.
   */
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
   * The parsed route-pattern AST. Useful for advanced consumers (e.g. matchers) that want to skip
   * re-parsing the source string.
   */
  get pattern(): RoutePattern<pattern> {
    if (!this.#pattern) {
      let parsed = parsePatternParts(this.#source)
      this.#pattern = createRoutePattern(serializeRoutePattern(parsed) as pattern, parsed)
    }
    return this.#pattern
  }

  /**
   * The route-pattern source string.
   */
  get source(): pattern {
    return this.#source
  }

  #source: pattern
  #pattern?: RoutePattern<pattern>

  /**
   * @param method The HTTP method this route matches
   * @param pattern The route-pattern source string or pre-parsed AST
   */
  constructor(method: method | 'ANY', pattern: pattern | RoutePattern<pattern>) {
    this.method = method
    if (typeof pattern === 'string') {
      this.#source = pattern
    } else {
      this.#source = getRoutePatternSource(pattern) as pattern
      this.#pattern = pattern
    }
  }

  /**
   * Build a URL href for this route using the given parameters.
   *
   * @param args The parameters to use for building the href
   * @returns The built URL href
   */
  href(...args: CreateHrefArgs<pattern>): string {
    return createHref(this.#pattern ?? this.#source, ...(args as any))
  }
}

/**
 * Build a {@link Route} type from a request method and pattern.
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
  let baseIsPattern = typeof baseOrDefs === 'string' || isRoutePattern(baseOrDefs)
  if (baseIsPattern) {
    return buildRouteMap(baseOrDefs, defs!)
  }
  return buildRouteMap('/', baseOrDefs)
}

function buildRouteMap<base extends string, defs extends RouteDefs>(
  base: base | RoutePattern<base>,
  defs: defs,
): BuildRouteMap<base, defs> {
  let routes: any = {}

  for (let key in defs) {
    let def = defs[key]

    if (def instanceof Route) {
      routes[key] = new Route(def.method, joinRoutePatterns(base, def.source))
    } else if (typeof def === 'string') {
      routes[key] = new Route('ANY', joinRoutePatterns(base, def))
    } else if (isRoutePattern(def)) {
      routes[key] = new Route('ANY', joinRoutePatterns(base, def))
    } else if (isRouteDefObject(def)) {
      routes[key] = new Route(def.method ?? 'ANY', joinRoutePatterns(base, def.pattern))
    } else {
      routes[key] = buildRouteMap(base, def as any)
    }
  }

  return routes
}

// prettier-ignore
export type BuildRouteMap<base extends string, defs extends RouteDefs> = Simplify<{
  -readonly [name in keyof defs]: (
    defs[name] extends Route<infer method extends RequestMethod | 'ANY', infer pattern extends string> ? Route<method, JoinPatterns<base, pattern>> :
    defs[name] extends RouteDef ? BuildRouteWithBase<base, defs[name]> :
    defs[name] extends RouteDefs ? BuildRouteMap<base, defs[name]> :
    never
  )
}>

// prettier-ignore
type BuildRouteWithBase<base extends string, def extends RouteDef> =
  def extends string ? Route<'ANY', JoinPatterns<base, def>> :
  def extends RoutePattern<infer pattern extends string> ? Route<'ANY', JoinPatterns<base, pattern>> :
  def extends { method: infer method extends RequestMethod | 'ANY', pattern: infer pattern } ? (
    pattern extends string ? Route<method, JoinPatterns<base, pattern>> :
    pattern extends RoutePattern<infer source extends string> ? Route<method, JoinPatterns<base, source>> :
    never
  ) :
  never

/**
 * A map of route names to route definitions.
 */
export interface RouteDefs {
  /**
   * Named route definition or nested route definition map.
   */
  [name: string]: Route | RouteDef | RouteDefs
}

/**
 * A route definition that can be a string pattern, pre-parsed `RoutePattern`, or an object with
 * method and pattern.
 */
export type RouteDef<source extends string = string> =
  | source
  | RoutePattern<source>
  | { method?: RequestMethod; pattern: source | RoutePattern<source> }

function isRoutePattern(value: unknown): value is RoutePattern {
  return (
    typeof value === 'object' &&
    value !== null &&
    'protocol' in value &&
    'hostname' in value &&
    'port' in value &&
    'pathname' in value &&
    'search' in value
  )
}

function isRouteDefObject(value: unknown): value is {
  method?: RequestMethod
  pattern: string | RoutePattern
} {
  return typeof value === 'object' && value !== null && 'pattern' in value
}

function joinRoutePatterns<base extends string, next extends string>(
  base: base | RoutePattern<base>,
  next: next | RoutePattern<next>,
): JoinPatterns<base, next> {
  let baseParts = typeof base === 'string' ? parsePatternParts(base) : base
  let nextParts = typeof next === 'string' ? parsePatternParts(next) : next
  return serializeRoutePattern({
    protocol: nextParts.protocol ?? baseParts.protocol,
    hostname: nextParts.hostname ?? baseParts.hostname,
    port: nextParts.port ?? baseParts.port,
    pathname: joinPathname(baseParts.pathname, nextParts.pathname),
    search: joinSearch(baseParts.search, nextParts.search),
  }) as JoinPatterns<base, next>
}

function createRoutePattern<source extends string>(
  source: source,
  parsed: ParsedRoutePattern,
): RoutePattern<source> {
  return {
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    port: parsed.port,
    pathname: parsed.pathname,
    search: parsed.search,
    get source() {
      return source
    },
    toString() {
      return source
    },
    toJSON() {
      return {
        protocol: parsed.protocol ?? '',
        hostname: parsed.hostname ? serializePart(parsed.hostname) : '',
        port: parsed.port ?? '',
        pathname: serializePart(parsed.pathname),
        search: serializeSearch(parsed.search),
      }
    },
  } as RoutePattern<source>
}

function getRoutePatternSource(pattern: RoutePattern): string {
  let source = pattern.source
  if (typeof source === 'string') return source
  return serializeRoutePattern(pattern)
}

function joinPathname(base: PartPattern, next: PartPattern): PartPattern {
  if (base.tokens.length === 0) return next
  if (next.tokens.length === 0) return base

  let tokens: Array<PartPatternToken> = []
  let baseLastNonOptionalIndex = base.tokens.findLastIndex(
    (token) => token.type !== '(' && token.type !== ')',
  )
  let baseLastNonOptional = base.tokens[baseLastNonOptionalIndex]
  let baseHasTrailingSeparator = baseLastNonOptional?.type === 'separator'

  base.tokens.forEach((token, index) => {
    if (index === baseLastNonOptionalIndex && token.type === 'separator') return
    tokens.push(token)
  })

  let nextFirstNonOptional = next.tokens.find((token) => token.type !== '(' && token.type !== ')')
  let needsSeparator =
    nextFirstNonOptional === undefined || nextFirstNonOptional.type !== 'separator'
  if (needsSeparator) tokens.push({ type: 'separator' })

  let tokenOffset = tokens.length
  next.tokens.forEach((token) => tokens.push(token))

  let optionals = new Map<number, number>()
  for (let [begin, end] of base.optionals) {
    if (baseHasTrailingSeparator) {
      if (begin > baseLastNonOptionalIndex) begin -= 1
      if (end > baseLastNonOptionalIndex) end -= 1
    }
    optionals.set(begin, end)
  }
  for (let [begin, end] of next.optionals) {
    optionals.set(tokenOffset + begin, tokenOffset + end)
  }

  return { tokens, optionals, type: 'pathname' }
}

function joinSearch(
  base: ParsedRoutePattern['search'],
  next: ParsedRoutePattern['search'],
): ParsedRoutePattern['search'] {
  let result = new Map<string, Set<string>>()

  for (let [name, values] of base) {
    result.set(name, new Set(values))
  }

  for (let [name, values] of next) {
    let current = result.get(name)
    if (current === undefined) {
      result.set(name, new Set(values))
      continue
    }
    for (let value of values) {
      current.add(value)
    }
  }

  return result
}

function serializeRoutePattern(pattern: ParsedRoutePattern): string {
  let protocol = pattern.protocol ?? ''
  let hostname = pattern.hostname ? serializePart(pattern.hostname) : ''
  let port = pattern.port ?? ''
  let pathname = serializePart(pattern.pathname)
  let search = serializeSearch(pattern.search)

  let result = ''
  if (protocol || hostname || port) {
    result += `${protocol}://${hostname}${port === '' ? '' : `:${port}`}`
  }
  result += '/' + pathname
  if (search) result += `?${search}`
  return result
}

function serializeSearch(search: ParsedRoutePattern['search']): string {
  if (search.size === 0) return ''
  let searchParams = new URLSearchParams()
  for (let [key, constraint] of search) {
    if (constraint.size === 0) {
      searchParams.append(key, '')
    } else {
      for (let value of constraint) {
        searchParams.append(key, value)
      }
    }
  }
  return searchParams.toString()
}

function escapeText(text: string): string {
  return text.replaceAll(/[:*()\\]/g, '\\$&')
}

function serializePart(part: PartPattern): string {
  let separator = part.type === 'hostname' ? '.' : '/'
  let result = ''
  for (let token of part.tokens) {
    if (token.type === '(' || token.type === ')') {
      result += token.type
      continue
    }

    if (token.type === 'text') {
      result += escapeText(token.text)
      continue
    }

    if (token.type === ':' || token.type === '*') {
      let name = token.name === '*' ? '' : token.name
      result += `${token.type}${name}`
      continue
    }

    if (token.type === 'separator') {
      result += separator
      continue
    }
  }
  return result
}
