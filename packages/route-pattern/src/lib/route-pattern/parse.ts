import { PartPattern } from './part-pattern.ts'
import type { Span } from './split.ts'
import type { RoutePattern } from '../route-pattern.ts'

export function parseProtocol(source: string, span: Span | null): RoutePattern['ast']['protocol'] {
  if (!span) return null
  let protocol = source.slice(...span)
  if (protocol === '' || protocol === 'http' || protocol === 'https' || protocol === 'http(s)') {
    return protocol === '' ? null : protocol
  }
  throw new ParseError('invalid protocol', source, span[0])
}

export function parseHostname(
  source: string,
  span: Span | null,
): RoutePattern['ast']['hostname'] | null {
  if (!span) return null
  let part = PartPattern.parse(source, { span, type: 'hostname' })
  if (isNamelessWildcard(part)) return null
  return part
}

function isNamelessWildcard(part: PartPattern): boolean {
  if (part.tokens.length !== 1) return false
  let token = part.tokens[0]
  if (token.type !== '*') return false
  return token.name === '*'
}

export function parseSearch(source: string): RoutePattern['ast']['search'] {
  let constraints = new Map<string, Set<string>>()

  let searchParams = new URLSearchParams(source)
  for (let [key, value] of searchParams) {
    let requiredValues = constraints.get(key)
    if (!requiredValues) {
      requiredValues = new Set()
      constraints.set(key, requiredValues)
    }
    if (value === '') continue
    requiredValues.add(value)
  }
  return constraints
}

type ParseErrorType =
  | 'unmatched ('
  | 'unmatched )'
  | 'missing variable name'
  | 'dangling escape'
  | 'invalid protocol'

/**
 * Error thrown when a route pattern cannot be parsed.
 */
export class ParseError extends Error {
  /**
   * The parse failure category.
   */
  type: ParseErrorType

  /**
   * Original pattern source being parsed.
   */
  source: string

  /**
   * Character index where parsing failed.
   */
  index: number

  constructor(type: ParseErrorType, source: string, index: number) {
    let underline = ' '.repeat(index) + '^'
    let message = `${type}\n\n${source}\n${underline}`

    super(message)
    this.name = 'ParseError'
    this.type = type
    this.source = source
    this.index = index
  }
}
