import type { Params } from '../params.ts'
import type * as RoutePattern from '../route-pattern/index.ts'

export type Matcher<data> = {
  add: (pattern: RoutePattern.AST, data: data) => void
  match: (url: URL) => { params: Params; data: data } | null
  size: number
}
