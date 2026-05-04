import type { RoutePatternAST } from '../ast.ts'
import type { Params } from '../types/params.ts'

export type MatchedParam = {
  type: ':' | '*'
  name: string
  value: string
  begin: number
  end: number
}

export type Match<source extends string = string, data = unknown> = {
  pattern: RoutePatternAST<source>
  data: data
  params: Params<source>
  paramsMeta: {
    hostname: ReadonlyArray<MatchedParam>
    pathname: ReadonlyArray<MatchedParam>
  }
}
