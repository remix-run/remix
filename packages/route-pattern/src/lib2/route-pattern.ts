import { split } from './split.ts'
import * as Part from './part/index.ts'

type AST = {
  protocol: Part.AST | undefined
  hostname: Part.AST | undefined
  port: string | undefined
  pathname: Part.AST | undefined
  search: string | undefined // todo
}

export function parse(source: string): AST {
  let ast: AST = {
    protocol: undefined,
    hostname: undefined,
    port: undefined,
    pathname: undefined,
    search: undefined,
  }

  let { protocol, hostname, port, pathname, search } = split(source)

  if (protocol && protocol[0] !== protocol[1]) {
    ast.protocol = Part.parse(source, protocol)
  }
  if (hostname && hostname[0] !== hostname[1]) {
    ast.hostname = Part.parse(source, hostname)
  }
  if (port && port[0] !== port[1]) {
    ast.port = source.slice(...port)
  }
  if (pathname && pathname[0] !== pathname[1]) {
    ast.pathname = Part.parse(source, pathname)
  }
  if (search && search[0] !== search[1]) {
    ast.search = source.slice(...search)
  }
  return ast
}
