import type { PartPattern, RoutePatternJSON, RoutePatternParts } from '../route-pattern.ts'
import { unreachable } from '../unreachable.ts'

export function serializePattern(pattern: RoutePatternParts): string {
  let { protocol, hostname, port, pathname, search } = serializePatternParts(pattern)

  let result = ''
  if (protocol || hostname || port) {
    result += `${protocol}://${hostname}${port === '' ? '' : `:${port}`}`
  }
  result += '/' + pathname
  if (search) result += `?${search}`
  return result
}

export function serializePatternParts(pattern: RoutePatternParts): RoutePatternJSON {
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
    }
    for (let value of constraint) {
      searchParams.append(key, value)
    }
  }
  return searchParams.toString()
}

export function serializePart(part: PartPattern): string {
  let separator = part.type === 'hostname' ? '.' : '/'
  let result = ''
  for (let token of part.tokens) {
    switch (token.type) {
      case '(':
      case ')':
        result += token.type
        break
      case 'text':
        result += token.text.replaceAll(/[:*()\\]/g, '\\$&')
        break
      case ':':
      case '*':
        result += `${token.type}${token.name === '*' ? '' : token.name}`
        break
      case 'separator':
        result += separator
        break
      default:
        unreachable(token)
    }
  }

  return result
}
