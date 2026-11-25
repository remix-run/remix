import { split, type Span } from './split.ts'
import { createRoutePattern } from '../route-pattern.ts'
import type {
  RoutePatternParts,
  PartPattern,
  PartPatternToken,
  RoutePattern,
} from '../route-pattern.ts'
import type { Mutable } from '../types/utils.ts'

const emptySearch: ReadonlyMap<string, ReadonlySet<string>> = new Map()
const emptyOptionals: ReadonlyMap<number, number> = new Map()
const emptyPathname: PartPattern = { tokens: [], optionals: emptyOptionals, type: 'pathname' }

/**
 * Parse a route pattern source string
 *
 * @param source The pattern source, e.g. `'/users/:id'` or `'https://:tenant.example.com/dashboard?tab'`.
 * @returns The parsed pattern.
 * @throws {ParseError} When the source is malformed.
 */
export function parsePattern<source extends string>(source: source): RoutePattern<source> {
  let spans = split(source)
  if (spans.port && !spans.hostname) {
    throw new ParseError('missing hostname', source, spans.port[0] - 1)
  }

  return createRoutePattern<source>({
    protocol: parseProtocol(source, spans.protocol),
    hostname: parseHostname(source, spans.hostname),
    port: spans.port ? source.slice(...spans.port) : null,
    pathname: spans.pathname
      ? parsePart(source, { span: spans.pathname, type: 'pathname' })
      : emptyPathname,
    search: spans.search ? parseSearch(source.slice(...spans.search)) : emptySearch,
  })
}

/**
 * Parse a single URL part (hostname or pathname).
 *
 * @private
 */
export function parsePart(
  source: string,
  options: { span?: Span; type: 'hostname' | 'pathname' },
): PartPattern {
  let start = options.span ? options.span[0] : 0
  let end = options.span ? options.span[1] : source.length
  let separatorCode = options.type === 'hostname' ? 46 : 47 // '.' or '/'

  let tokens: Array<Mutable<PartPatternToken>> = []
  let tokenIndices: Array<number> = []
  let optionals: Map<number, number> | null = null
  let hasParams = false

  let i = start
  let optionalStack: Array<{ tokenIndex: number; sourceIndex: number }> | null = null
  let emptyOptionalIndex = -1

  while (i < end) {
    let code = source.charCodeAt(i)

    if (code === separatorCode) {
      tokens.push({ type: 'separator' })
      tokenIndices.push(i)
      i += 1
      continue
    }

    if (code === 40) {
      // '('
      if (optionalStack === null) optionalStack = []
      optionalStack.push({ tokenIndex: tokens.length, sourceIndex: i })
      tokens.push({ type: '(' })
      tokenIndices.push(i)
      i += 1
      continue
    }

    if (code === 41) {
      // ')'
      let optional = optionalStack?.pop()
      if (optional === undefined) {
        throw new ParseError('unmatched )', source, i)
      }
      if (optional.tokenIndex === tokens.length - 1 && emptyOptionalIndex === -1) {
        emptyOptionalIndex = optional.sourceIndex
      }
      if (optionals === null) optionals = new Map()
      optionals.set(optional.tokenIndex, tokens.length)
      tokens.push({ type: ')' })
      tokenIndices.push(i)
      i += 1
      continue
    }

    if (code === 58) {
      // ':'
      let nameStart = i + 1
      let nameEnd = readIdentifierEnd(source, nameStart, end)
      if (nameEnd === nameStart) {
        throw new ParseError('missing variable name', source, i)
      }
      tokens.push({ type: ':', name: source.slice(nameStart, nameEnd) })
      tokenIndices.push(i)
      hasParams = true
      i = nameEnd
      continue
    }

    if (code === 42) {
      // '*'
      let nameStart = i + 1
      let nameEnd = readIdentifierEnd(source, nameStart, end)
      tokens.push({
        type: '*',
        name: nameEnd === nameStart ? '*' : source.slice(nameStart, nameEnd),
      })
      tokenIndices.push(i)
      hasParams = true
      i = nameEnd
      continue
    }

    if (code === 92) {
      // '\'
      if (i + 1 === end) {
        throw new ParseError('dangling escape', source, i)
      }
      let escaped = source.slice(i + 1, i + 2)
      let lastToken = tokens.length > 0 ? tokens[tokens.length - 1] : undefined
      if (lastToken !== undefined && lastToken.type === 'text') {
        lastToken.text += escaped
      } else {
        tokens.push({ type: 'text', text: escaped })
        tokenIndices.push(i)
      }
      i += 2
      continue
    }

    let textStart = i
    i += 1
    while (i < end) {
      let c = source.charCodeAt(i)
      if (c === separatorCode || c === 40 || c === 41 || c === 58 || c === 42 || c === 92) {
        break
      }
      i += 1
    }
    let chunk = source.slice(textStart, i)
    let lastToken = tokens.length > 0 ? tokens[tokens.length - 1] : undefined
    if (lastToken !== undefined && lastToken.type === 'text') {
      lastToken.text += chunk
    } else {
      tokens.push({ type: 'text', text: chunk })
      tokenIndices.push(textStart)
    }
  }

  if (optionalStack !== null && optionalStack.length > 0) {
    throw new ParseError('unmatched (', source, optionalStack[optionalStack.length - 1].sourceIndex)
  }
  if (emptyOptionalIndex !== -1) {
    throw new ParseError('empty optional', source, emptyOptionalIndex)
  }

  let resolvedOptionals = optionals ?? emptyOptionals
  if (hasParams) {
    validateTokenGrammar(source, tokens, resolvedOptionals, tokenIndices)
  }
  if (resolvedOptionals.size >= 2) {
    validateOptionalCaptureSchemas(source, tokens, resolvedOptionals, tokenIndices)
  }

  return { tokens, optionals: resolvedOptionals, type: options.type }
}

function readIdentifierEnd(source: string, start: number, end: number): number {
  if (start >= end) return start
  let first = source.charCodeAt(start)
  if (!isIdentifierStart(first)) return start
  let i = start + 1
  while (i < end && isIdentifierContinue(source.charCodeAt(i))) {
    i += 1
  }
  return i
}

function isIdentifierStart(code: number): boolean {
  return (
    (code >= 97 && code <= 122) || // a-z
    (code >= 65 && code <= 90) || // A-Z
    code === 95 || // _
    code === 36 // $
  )
}

function isIdentifierContinue(code: number): boolean {
  return isIdentifierStart(code) || (code >= 48 && code <= 57) // 0-9
}

function validateTokenGrammar(
  source: string,
  tokens: ReadonlyArray<PartPatternToken>,
  optionals: ReadonlyMap<number, number>,
  tokenIndices: ReadonlyArray<number>,
): void {
  for (let index = 0; index < tokens.length; index++) {
    let token = tokens[index]
    if (token.type !== ':' && token.type !== '*') continue

    let immediate = tokens[index + 1]
    if (immediate === undefined || immediate.type === 'separator') continue
    if (
      token.type === ':' &&
      (immediate.type === '*' || (immediate.type === 'text' && immediate.text.charCodeAt(0) === 46))
    ) {
      continue
    }
    if (token.type === '*' && (immediate.type === ':' || immediate.type === 'text')) {
      continue
    }

    for (let next of nextConsumingTokenIndices(tokens, optionals, index + 1)) {
      if (next === tokens.length) continue
      let nextToken = tokens[next]

      if (token.type === '*') {
        if (nextToken.type === '*') {
          throw new ParseError('adjacent wildcards', source, tokenIndices[next])
        }
        continue
      }

      if (
        nextToken.type === 'separator' ||
        nextToken.type === '*' ||
        (nextToken.type === 'text' && nextToken.text.charCodeAt(0) === 46)
      ) {
        continue
      }
      throw new ParseError('invalid param delimiter', source, tokenIndices[next])
    }
  }
}

function nextConsumingTokenIndices(
  tokens: ReadonlyArray<PartPatternToken>,
  optionals: ReadonlyMap<number, number>,
  start: number,
): Set<number> {
  let result = new Set<number>()
  let pending = [start]
  let visited = new Set<number>()

  while (pending.length > 0) {
    let index = pending.pop()
    if (index === undefined) break
    if (visited.has(index)) continue
    visited.add(index)

    let token = tokens[index]
    if (token === undefined) {
      result.add(tokens.length)
    } else if (token.type === '(') {
      let end = optionals.get(index)
      if (end === undefined) throw new Error('missing optional end')
      pending.push(index + 1, end + 1)
    } else if (token.type === ')') {
      pending.push(index + 1)
    } else {
      result.add(index)
    }
  }

  return result
}

function validateOptionalCaptureSchemas(
  source: string,
  tokens: ReadonlyArray<PartPatternToken>,
  optionals: ReadonlyMap<number, number>,
  tokenIndices: ReadonlyArray<number>,
): void {
  for (let [begin, end] of optionals) {
    let nextBegin = end + 1
    if (tokens[nextBegin]?.type !== '(') continue
    let nextEnd = optionals.get(nextBegin)
    if (nextEnd === undefined) continue

    let first = optionalStructure(tokens, begin + 1, end)
    let second = optionalStructure(tokens, nextBegin + 1, nextEnd)
    if (first.structure === second.structure && first.captures !== second.captures) {
      throw new ParseError('ambiguous optional captures', source, tokenIndices[nextBegin])
    }
  }
}

function optionalStructure(
  tokens: ReadonlyArray<PartPatternToken>,
  begin: number,
  end: number,
): { structure: string; captures: string } {
  let structure = ''
  let captures = ''
  for (let i = begin; i < end; i++) {
    let token = tokens[i]
    if (token.type === ':' || token.type === '*') {
      structure += token.type
      captures += `${token.type}:${token.name}|`
    } else if (token.type === 'text') {
      structure += `t:${token.text}|`
    } else {
      structure += `${token.type}|`
    }
  }
  return { structure, captures }
}

function parseProtocol(source: string, span: Span | null): RoutePatternParts['protocol'] {
  if (!span) return null
  let protocol = source.slice(...span)
  if (protocol === '' || protocol === 'http' || protocol === 'https' || protocol === 'http(s)') {
    return protocol === '' ? null : protocol
  }
  throw new ParseError('invalid protocol', source, span[0])
}

function parseHostname(source: string, span: Span | null): RoutePatternParts['hostname'] | null {
  if (!span) return null
  let part = parsePart(source, { span, type: 'hostname' })
  if (isNamelessWildcard(part)) return null
  return part
}

function isNamelessWildcard(part: PartPattern): boolean {
  if (part.tokens.length !== 1) return false
  let token = part.tokens[0]
  if (token.type !== '*') return false
  return token.name === '*'
}

function parseSearch(source: string): RoutePatternParts['search'] {
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
  | 'missing hostname'
  | 'adjacent wildcards'
  | 'invalid param delimiter'
  | 'empty optional'
  | 'ambiguous optional captures'

/** Error thrown when a route pattern cannot be parsed. */
export class ParseError extends Error {
  /** The parse failure category. */
  type: ParseErrorType

  /** Original pattern source being parsed. */
  source: string

  /** Character index where parsing failed. */
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
