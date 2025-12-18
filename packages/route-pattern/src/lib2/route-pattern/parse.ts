import type { AST } from './ast.ts'
import { split } from './split.ts'
import * as Part from '../part/index.ts'
import * as Search from './search.ts'

export function parse(source: string): AST {
  let ast: AST = {
    protocol: undefined,
    hostname: undefined,
    port: undefined,
    pathname: undefined,
    search: new Map(),
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
    ast.search = Search.parse(source.slice(...search))
  }

  return ast
}
