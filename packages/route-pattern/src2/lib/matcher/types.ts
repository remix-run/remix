import type { RoutePatternAST } from '../ast.ts'

export type MatchedParam = {
  type: ':' | '*'
  name: string
  value: string
  begin: number
  end: number
}

export type Match<data = unknown> = {
  pattern: RoutePatternAST
  data: data
  params: Record<string, string | undefined>
  paramsMeta: {
    hostname: ReadonlyArray<MatchedParam>
    pathname: ReadonlyArray<MatchedParam>
  }
}
