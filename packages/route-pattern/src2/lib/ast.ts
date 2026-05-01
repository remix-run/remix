/** A token in a parsed pattern part (hostname or pathname). */
export type PartPatternToken =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'separator' }
  | { readonly type: '(' | ')' }
  | { readonly type: ':' | '*'; readonly name: string }

/** Parsed form of a single URL part (hostname or pathname). */
export type PartPatternAST = {
  readonly tokens: ReadonlyArray<PartPatternToken>
  /** Maps a `(` token index to the index of its matching `)`. */
  readonly optionals: ReadonlyMap<number, number>
  readonly type: 'hostname' | 'pathname'
}

/**
 * Parsed form of a route pattern.
 *
 * The `source` generic is preserved through TS alias inference (no runtime
 * field needed) so downstream APIs like `toHref` can derive typed params
 * from the original pattern source string.
 */
export type RoutePatternAST<source extends string = string> = {
  readonly protocol: 'http' | 'https' | 'http(s)' | null
  readonly hostname: PartPatternAST | null
  readonly port: string | null
  readonly pathname: PartPatternAST
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
