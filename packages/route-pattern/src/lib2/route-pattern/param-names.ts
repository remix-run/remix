import type { AST } from './ast.ts'

export function paramNames(ast: AST): Array<string> {
  let paramNames: Array<string> = []
  if (ast.protocol) paramNames.push(...ast.protocol.paramNames)
  if (ast.hostname) paramNames.push(...ast.hostname.paramNames)
  if (ast.pathname) paramNames.push(...ast.pathname.paramNames)
  return paramNames
}
