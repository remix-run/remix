import { parsePattern } from './route-pattern/parse.ts'
import { serializePattern, serializePatternParts } from './route-pattern/serialize.ts'

/** A token in a parsed pattern part (hostname or pathname). */
export type PartPatternToken =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'separator' }
  | { readonly type: '(' | ')' }
  | { readonly type: ':' | '*'; readonly name: string }

/** Parsed form of a single URL part (hostname or pathname). */
export type PartPattern = {
  readonly tokens: ReadonlyArray<PartPatternToken>
  /** Maps a `(` token index to the index of its matching `)`. */
  readonly optionals: ReadonlyMap<number, number>
  readonly type: 'hostname' | 'pathname'
}

export type ParsedRoutePattern = {
  readonly protocol: 'http' | 'https' | 'http(s)' | null
  readonly hostname: PartPattern | null
  readonly port: string | null
  readonly pathname: PartPattern
  /**
   * Required values keyed by search param name.
   *
   * Follows
   * [WHATWG's application/x-www-form-urlencoded parsing](https://url.spec.whatwg.org/#application/x-www-form-urlencoded) spec
   * (same as [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams#percent_encoding)).
   * For example, `+` is decoded as ` ` (literal space) instead of `%20`.
   *
   * - **Empty `Set`**: key must appear; value may be anything (including empty).
   * - **Non-empty `Set`**: key must appear with all listed values; extra values are OK.
   */
  readonly search: ReadonlyMap<string, ReadonlySet<string>>
}

/** Serialized URL pattern parts returned by {@link RoutePattern.toJSON}. */
export interface RoutePatternJSON {
  /** Serialized protocol constraint, or an empty string when omitted. */
  protocol: string

  /** Serialized hostname pattern, or an empty string when omitted. */
  hostname: string

  /** Serialized port constraint, or an empty string when omitted. */
  port: string

  /** Serialized pathname pattern without a leading `/`. */
  pathname: string

  /** Serialized search constraint string without a leading `?`. */
  search: string
}

/** Metadata for a hostname or pathname param in a {@link RoutePattern}. */
export interface RoutePatternParam {
  /** The URL part that contains the param. */
  readonly part: 'hostname' | 'pathname'

  /** The param token kind: `:` for variables or `*` for wildcards. */
  readonly type: ':' | '*'

  /** Param name, or `*` for an unnamed wildcard. */
  readonly name: string

  /** Whether the param is inside an optional group. */
  readonly optional: boolean
}

const routePatternConstructorKey: unique symbol = Symbol('RoutePattern constructor key')
declare const routePatternSourceBrand: unique symbol
const routePatternParts = new WeakMap<RoutePattern, ParsedRoutePattern>()

/** A parsed route pattern */
export class RoutePattern<source extends string = string> {
  declare readonly [routePatternSourceBrand]: source

  /**
   * Create a new `RoutePattern` by parsing a source string.
   *
   * @param source The route pattern source string.
   * @returns The parsed route pattern.
   */
  static parse<source extends string>(source: source): RoutePattern<source> {
    return parsePattern(source)
  }

  private constructor(key: typeof routePatternConstructorKey, parsed?: ParsedRoutePattern) {
    if (key !== routePatternConstructorKey) {
      throw new TypeError('RoutePattern constructor is private; use RoutePattern.parse()')
    }
    if (parsed === undefined) {
      throw new TypeError('RoutePattern constructor is private; use RoutePattern.parse()')
    }
    routePatternParts.set(this, parsed)
  }

  static [routePatternConstructorKey]<source extends string>(
    parsed: ParsedRoutePattern,
  ): RoutePattern<source> {
    return new RoutePattern<source>(routePatternConstructorKey, parsed)
  }

  /** Normalized string representation of this pattern */
  get source(): string {
    return serializePattern(getRoutePatternParts(this))
  }

  /**
   * Returns a string representing this route pattern.
   *
   * @returns The same normalized pattern string as `RoutePattern.source`.
   */
  toString(): string {
    return this.source
  }

  /**
   * Returns a JSON-serializable object containing each serialized part of this route pattern.
   *
   * @returns The serialized protocol, hostname, port, pathname, and search.
   */
  toJSON(): RoutePatternJSON {
    return serializePatternParts(getRoutePatternParts(this))
  }
}

export function createRoutePattern<source extends string>(
  parsed: ParsedRoutePattern,
): RoutePattern<source> {
  return RoutePattern[routePatternConstructorKey]<source>(parsed)
}

export function getRoutePatternParts(pattern: RoutePattern): ParsedRoutePattern {
  let parsed = routePatternParts.get(pattern)
  if (parsed === undefined) {
    throw new TypeError('Invalid RoutePattern')
  }
  return parsed
}

/**
 * Returns hostname and pathname params in source order without exposing parsed pattern internals.
 *
 * @param pattern The parsed route pattern to inspect.
 * @returns Param metadata for variables and wildcards in the pattern.
 */
export function getRoutePatternParams(pattern: RoutePattern): ReadonlyArray<RoutePatternParam> {
  let parsed = getRoutePatternParts(pattern)
  let params: Array<RoutePatternParam> = []

  if (parsed.hostname) {
    params.push(...getPartParams(parsed.hostname))
  }
  params.push(...getPartParams(parsed.pathname))

  return params
}

function getPartParams(part: PartPattern): Array<RoutePatternParam> {
  let params: Array<RoutePatternParam> = []

  for (let i = 0; i < part.tokens.length; i++) {
    let token = part.tokens[i]
    if (token.type !== ':' && token.type !== '*') continue
    params.push({
      part: part.type,
      type: token.type,
      name: token.name,
      optional: isOptionalToken(part, i),
    })
  }

  return params
}

function isOptionalToken(part: PartPattern, index: number): boolean {
  for (let [begin, end] of part.optionals) {
    if (begin < index && index < end) return true
  }
  return false
}
