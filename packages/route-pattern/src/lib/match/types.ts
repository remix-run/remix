import type { RoutePattern } from '../route-pattern.ts'
import type { ParseParams } from '../types/params.ts'
import type { Simplify } from '../types/utils.ts'

/** Params extracted from a route pattern match. */
export type MatchParams<source extends string> =
  ParseParams<source> extends infer params
    ? [params] extends [never]
      ? never
      : Simplify<Omit<params, '*'>>
    : never

export type MatchParamMeta = {
  type: ':' | '*'
  name: string
  value: string
  /** Start offset after pathname is normalized. */
  begin: number
  /** End offset after pathname is normalized. */
  end: number
}

export type Match<source extends string = string, data = unknown> = {
  url: URL
  pattern: RoutePattern<source>
  data: data
  params: MatchParams<source>
  paramsMeta: {
    hostname: ReadonlyArray<MatchParamMeta>
    pathname: ReadonlyArray<MatchParamMeta>
  }
}
