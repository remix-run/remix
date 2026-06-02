import { parsePattern } from './route-pattern/parse.ts'
import { serializePattern, serializePatternParts } from './route-pattern/serialize.ts'
import type { ParsedRoutePattern } from './route-pattern/types.ts'

export type { PartPattern, PartPatternToken } from './route-pattern/types.ts'

export interface RoutePatternJSON {
  protocol: string
  hostname: string
  port: string
  pathname: string
  search: string
}

/** A parsed route pattern */
export class RoutePattern<source extends string = string> implements ParsedRoutePattern {
  readonly protocol: ParsedRoutePattern['protocol']
  readonly hostname: ParsedRoutePattern['hostname']
  readonly port: ParsedRoutePattern['port']
  readonly pathname: ParsedRoutePattern['pathname']
  readonly search: ParsedRoutePattern['search']

  /**
   * Create a new `RoutePattern` by parsing a source string.
   *
   * @param source The route pattern source string.
   * @returns The parsed route pattern.
   */
  static parse<source extends string>(source: source): RoutePattern<source> {
    return parsePattern(source)
  }

  /**
   * Create a new `RoutePattern` from parsed parts of a route pattern.
   *
   * Useful for efficiently deriving new patterns from already parsed patterns.
   * Unless you know what you are doing, you probably want `RoutePattern.parse`.
   *
   * @param parsed Parsed route pattern parts.
   */
  constructor(parsed: ParsedRoutePattern) {
    this.protocol = parsed.protocol
    this.hostname = parsed.hostname
    this.port = parsed.port
    this.pathname = parsed.pathname
    this.search = parsed.search
  }

  /** Normalized string representation of this pattern */
  get source(): string {
    return serializePattern(this)
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
    return serializePatternParts(this)
  }
}
