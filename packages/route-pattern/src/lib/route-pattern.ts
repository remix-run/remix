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

export type RoutePatternParts = {
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

/** A variable (`:name`) or wildcard (`*name`) declared in a {@link RoutePattern}. */
export interface RoutePatternCapture {
  /** The URL part that contains the capture. */
  readonly part: 'hostname' | 'pathname'

  /** The capture token kind: `:` for variables or `*` for wildcards. */
  readonly type: ':' | '*'

  /** Capture name, or `*` for an unnamed wildcard. */
  readonly name: string

  /** Whether the capture is inside an optional group. */
  readonly optional: boolean
}

declare const brand: unique symbol

/**
 * A parsed route pattern.
 *
 * Create one with {@link RoutePattern.parse}. The constructor is public but takes a parsed
 * representation that is not part of the public API; prefer `RoutePattern.parse` instead. Use
 * `source`, `toString()`, `toJSON()`, and {@link getRoutePatternCaptures} for inspection.
 */
export class RoutePattern<source extends string = string> {
  declare readonly [brand]: source

  /** Parsed parts of this pattern. Internal; not part of the public API. */
  readonly _parts: RoutePatternParts

  /**
   * Create a new `RoutePattern` from its parsed parts.
   *
   * The parts are not part of the public API. Use {@link RoutePattern.parse} to create a pattern
   * from a source string.
   *
   * @param parts The parsed parts of the pattern.
   */
  constructor(parts: RoutePatternParts) {
    this._parts = parts
  }

  /**
   * Create a new `RoutePattern` by parsing a source string.
   *
   * @param source The route pattern source string.
   * @returns The parsed route pattern.
   */
  static parse<source extends string>(source: source): RoutePattern<source> {
    return parsePattern(source)
  }

  /** Normalized string representation of this pattern. */
  get source(): string {
    return serializePattern(this._parts)
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
    return serializePatternParts(this._parts)
  }
}

export function createRoutePattern<source extends string>(
  parts: RoutePatternParts,
): RoutePattern<source> {
  return new RoutePattern<source>(parts)
}

/**
 * Returns the hostname and pathname captures in a pattern in source order without exposing parsed
 * pattern internals.
 *
 * @param pattern The route pattern to inspect.
 * @returns Metadata for each variable and wildcard in the pattern.
 */
export function getRoutePatternCaptures(pattern: RoutePattern): ReadonlyArray<RoutePatternCapture> {
  let parsed = pattern._parts
  let captures: Array<RoutePatternCapture> = []

  if (parsed.hostname) collectCaptures(parsed.hostname, captures)
  collectCaptures(parsed.pathname, captures)

  return captures
}

function collectCaptures(part: PartPattern, out: Array<RoutePatternCapture>): void {
  let depth = 0
  for (let token of part.tokens) {
    if (token.type === '(') {
      depth++
    } else if (token.type === ')') {
      depth--
    } else if (token.type === ':' || token.type === '*') {
      out.push({ part: part.type, type: token.type, name: token.name, optional: depth > 0 })
    }
  }
}
