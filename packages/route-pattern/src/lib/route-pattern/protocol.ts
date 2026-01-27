import { ParseError } from '../errors.ts'
import type { RoutePattern } from '../route-pattern.ts'
import type { Span } from './split.ts'

export function parse(source: string, span: Span | null): RoutePattern['ast']['protocol'] {
  if (!span) return null
  let protocol = source.slice(...span)
  if (protocol === '' || protocol === 'http' || protocol === 'https' || protocol === 'http(s)') {
    return protocol === '' ? null : protocol
  }
  throw new ParseError('invalid protocol', source, span[0])
}
