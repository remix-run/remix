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

/**
 * Parse a search string into search constraints.
 *
 * Search constraints define what query params must be present:
 * - `null`: param must be present (e.g., `?q`, `?q=`, `?q=1`)
 * - Empty `Set`: param must be present with a value (e.g., `?q=1`)
 * - Non-empty `Set`: param must be present with all these values (e.g., `?q=x&q=y`)
 *
 * Examples:
 * ```ts
 * parse('q')       // -> Map([['q', null]])
 * parse('q=')      // -> Map([['q', new Set()]])
 * parse('q=x&q=y') // -> Map([['q', new Set(['x', 'y'])]])
 * ```
 *
 * @param source the search string to parse (without leading `?`)
 * @returns the parsed search constraints
 */
export function parseSearch(source: string): RoutePattern['ast']['search'] {
  let constraints: RoutePattern['ast']['search'] = new Map()

  for (let param of source.split('&')) {
    if (param === '') continue
    let equalIndex = param.indexOf('=')

    // `?q`
    if (equalIndex === -1) {
      let name = decodeURIComponent(param)
      if (!constraints.get(name)) {
        constraints.set(name, null)
      }
      continue
    }

    let name = decodeURIComponent(param.slice(0, equalIndex))
    let value = decodeURIComponent(param.slice(equalIndex + 1))

    // `?q=`
    if (value.length === 0) {
      if (!constraints.get(name)) {
        constraints.set(name, new Set())
      }
      continue
    }

    // `?q=1`
    let constraint = constraints.get(name)
    constraints.set(name, constraint ? constraint.add(value) : new Set([value]))
  }

  return constraints
}

type ParseErrorType =
  | 'unmatched ('
  | 'unmatched )'
  | 'missing variable name'
  | 'dangling escape'
  | 'invalid protocol'

export class ParseError extends Error {
  type: ParseErrorType
  source: string
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
