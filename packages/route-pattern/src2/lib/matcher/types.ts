import type { RoutePatternAST } from '../ast.ts'

export type MatchedParam = {
  readonly type: ':' | '*'
  readonly name: string
  readonly value: string
  readonly begin: number
  readonly end: number
}

/** Ordered matched params for a single URL part (hostname or pathname). */
export type PartMatch = ReadonlyArray<MatchedParam>

/** Result of a successful pattern match. */
export type Match<source extends string = string, data = unknown> = {
  readonly ast: RoutePatternAST<source>
  readonly url: URL
  readonly data: data
  readonly params: Readonly<Record<string, string | undefined>>
  readonly paramsMeta: {
    readonly hostname: PartMatch
    readonly pathname: PartMatch
  }
}

export type MatcherOptions = {
  /**
   * When `true`, pathname matching is case-insensitive for all patterns. Hostname is always
   * case-insensitive; search remains case-sensitive. Defaults to `false`.
   */
  ignoreCase?: boolean
}
