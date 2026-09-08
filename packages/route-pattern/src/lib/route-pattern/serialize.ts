import type { RoutePatternParts, PartPattern } from '../route-pattern.ts'
import { unreachable } from '../unreachable.ts'

export function serializePattern(pattern: RoutePatternParts): string {
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

export function serializePatternParts(pattern: RoutePatternParts): {
  protocol: string
  hostname: string
  port: string
  pathname: string
  search: string
} {
  return {
    protocol: serializeProtocol(pattern),
    hostname: serializeHostname(pattern),
    port: serializePort(pattern),
    pathname: serializePathname(pattern),
    search: serializeSearch(pattern),
  }
}

export function serializeProtocol(pattern: RoutePatternParts): string {
  return pattern.protocol ?? ''
}

export function serializeHostname(pattern: RoutePatternParts): string {
  return pattern.hostname ? serializePart(pattern.hostname) : ''
}

export function serializePort(pattern: RoutePatternParts): string {
  return pattern.port ?? ''
}

export function serializePathname(pattern: RoutePatternParts): string {
  return serializePart(pattern.pathname)
}

export function serializeSearch(pattern: RoutePatternParts): string {
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

function escapeText(text: string): string {
  return text.replaceAll(/[:*()\\]/g, '\\$&')
}

export function serializePart(part: PartPattern): string {
  let separator = part.type === 'hostname' ? '.' : '/'
  let result = ''
  for (let token of part.tokens) {
    if (token.type === '(' || token.type === ')') {
      result += token.type
      continue
    }

    if (token.type === 'text') {
      result += escapeText(token.text)
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
