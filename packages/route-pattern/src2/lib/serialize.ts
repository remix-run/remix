import type { PartPattern, RoutePattern } from './route-pattern.ts'
import { unreachable } from './unreachable.ts'

/** Pre-serialized parts of a route pattern. Empty string for absent parts (mirrors `URL`). */
export type SerializedPatternParts = {
  protocol: string
  hostname: string
  port: string
  pathname: string
  search: string
}

/** Serialize a route pattern back to its source string. */
export function serializePattern(pattern: RoutePattern): string {
  let protocol = serializeProtocol(pattern)
  let hostname = serializeHostname(pattern)
  let port = serializePort(pattern)
  let pathname = serializePathname(pattern)
  let search = serializeSearch(pattern)

  let result = ''
  if (protocol || hostname || port) {
    result += `${protocol}://${hostname}${port === '' ? '' : `:${port}`}`
  }
  result += '/' + pathname
  if (search) result += `?${search}`
  return result
}

/**
 * Serialize each part of a route pattern as a string.
 *
 * Destructure to grab one part. Empty string for absent parts.
 */
export function serializePatternParts(pattern: RoutePattern): SerializedPatternParts {
  return {
    protocol: serializeProtocol(pattern),
    hostname: serializeHostname(pattern),
    port: serializePort(pattern),
    pathname: serializePathname(pattern),
    search: serializeSearch(pattern),
  }
}

/** Serialize the protocol of a route pattern. Empty string if absent. */
export function serializeProtocol(pattern: RoutePattern): string {
  return pattern.protocol ?? ''
}

/** Serialize the hostname of a route pattern. Empty string if absent. */
export function serializeHostname(pattern: RoutePattern): string {
  return pattern.hostname ? serializePart(pattern.hostname) : ''
}

/** Serialize the port of a route pattern. Empty string if absent. */
export function serializePort(pattern: RoutePattern): string {
  return pattern.port ?? ''
}

/** Serialize the pathname of a route pattern. */
export function serializePathname(pattern: RoutePattern): string {
  return serializePart(pattern.pathname)
}

/** Serialize the search of a route pattern. Empty string if absent. */
export function serializeSearch(pattern: RoutePattern): string {
  if (pattern.search.size === 0) return ''
  let searchParams = new URLSearchParams()
  for (let [key, constraint] of pattern.search) {
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

/** @private */
export function serializePart(part: PartPattern): string {
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
