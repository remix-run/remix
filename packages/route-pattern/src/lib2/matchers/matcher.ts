import type * as RoutePattern from '../route-pattern/index.ts'

export type Matcher<data> = {
  add: (pattern: RoutePattern.AST, data: data) => void
  match: (url: URL) => data | null
  size: number
}
