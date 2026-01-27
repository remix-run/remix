import { PartPattern } from './part-pattern.ts'
import type { Span } from './split.ts'

export function parse(source: string, span: Span | null): PartPattern | null {
  if (!span) return null
  let part = PartPattern.parse(source, {
    span,
    type: 'hostname',
    ignoreCase: false,
  })
  if (isNamelessWildcard(part)) return null
  return part
}

function isNamelessWildcard(part: PartPattern): boolean {
  if (part.tokens.length !== 1) return false
  let token = part.tokens[0]
  if (token.type !== '*') return false
  let name = part.paramNames[token.nameIndex]
  return name === '*'
}
