import type * as RoutePattern from '../route-pattern/index.ts'

export type Params = Record<string, string | undefined>

export type Matcher<data> = {
  add: (pattern: RoutePattern.AST, data: data) => void
  match: (url: URL) => { params: Params; data: data } | null
  matchAll: (url: URL) => Array<{ params: Params; data: data }>
  size: number
}
