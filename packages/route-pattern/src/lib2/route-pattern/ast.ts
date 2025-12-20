import type * as PartPattern from '../part-pattern/index.ts'
import type * as Search from './search.ts'

export type AST = {
  protocol: PartPattern.AST | undefined
  hostname: PartPattern.AST | undefined
  port: string | undefined
  pathname: PartPattern.AST | undefined
  search: Search.Constraints
}
