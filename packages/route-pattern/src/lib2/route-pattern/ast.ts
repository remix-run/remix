import type * as Part from './part/index.ts'

export type AST = {
  protocol: Part.AST | undefined
  hostname: Part.AST | undefined
  port: string | undefined
  pathname: Part.AST | undefined
  search: string | undefined // todo
}
