import type * as Part from './part/index.ts'
import type * as Search from './search.ts'

export type AST = {
  protocol: Part.AST | undefined
  hostname: Part.AST | undefined
  port: string | undefined
  pathname: Part.AST | undefined
  search: Search.Constraints
}
