import type { PartPatternAST, RoutePatternAST } from './ast.ts'
import { unreachable } from './unreachable.ts'

/** Pre-serialized parts of a route pattern AST. Empty string for absent parts (mirrors `URL`). */
export type SerializedPatternParts = {
  protocol: string
  hostname: string
  port: string
  pathname: string
  search: string
}

/** Serialize a route pattern AST back to its source string. */
export function serializePattern(ast: RoutePatternAST): string {
  let protocol = serializeProtocol(ast)
  let hostname = serializeHostname(ast)
  let port = serializePort(ast)
  let pathname = serializePathname(ast)
  let search = serializeSearch(ast)

  let result = ''
  if (protocol || hostname || port) {
    result += `${protocol}://${hostname}${port === '' ? '' : `:${port}`}`
  }
  result += '/' + pathname
  if (search) result += `?${search}`
  return result
}

/**
 * Serialize each part of a route pattern AST as a string.
 *
 * Destructure to grab one part. Empty string for absent parts.
 */
export function serializePatternParts(ast: RoutePatternAST): SerializedPatternParts {
  return {
    protocol: serializeProtocol(ast),
    hostname: serializeHostname(ast),
    port: serializePort(ast),
    pathname: serializePathname(ast),
    search: serializeSearch(ast),
  }
}

/** Serialize the protocol of a route pattern AST. Empty string if absent. */
export function serializeProtocol(ast: RoutePatternAST): string {
  return ast.protocol ?? ''
}

/** Serialize the hostname of a route pattern AST. Empty string if absent. */
export function serializeHostname(ast: RoutePatternAST): string {
  return ast.hostname ? serializePart(ast.hostname) : ''
}

/** Serialize the port of a route pattern AST. Empty string if absent. */
export function serializePort(ast: RoutePatternAST): string {
  return ast.port ?? ''
}

/** Serialize the pathname of a route pattern AST. */
export function serializePathname(ast: RoutePatternAST): string {
  return serializePart(ast.pathname)
}

/** Serialize the search of a route pattern AST. Empty string if absent. */
export function serializeSearch(ast: RoutePatternAST): string {
  if (ast.search.size === 0) return ''
  let searchParams = new URLSearchParams()
  for (let [key, constraint] of ast.search) {
    if (constraint.size === 0) {
      searchParams.append(key, '')
    } else {
      for (let value of constraint) {
        searchParams.append(key, value)
      }
    }
  }
  return searchParams.toString()
}

/** Internal: serialize a single part AST. Not part of the public `/ast` export. */
export function serializePart(part: PartPatternAST): string {
  let separator = part.type === 'hostname' ? '.' : '/'
  let result = ''
  for (let token of part.tokens) {
    if (token.type === '(' || token.type === ')') {
      result += token.type
      continue
    }

    if (token.type === 'text') {
      result += token.text
      continue
    }

    if (token.type === ':' || token.type === '*') {
      let name = token.name === '*' ? '' : token.name
      result += `${token.type}${name}`
      continue
    }

    if (token.type === 'separator') {
      result += separator
      continue
    }

    unreachable(token.type)
  }

  return result
}
