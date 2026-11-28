import { split } from './split.ts'
import type { Span } from './split.ts'
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

export const separatorToken: PartPatternToken = { type: 'separator' }
const openOptionalToken: PartPatternToken = { type: '(' }
const closeOptionalToken: PartPatternToken = { type: ')' }

/**
 * Parse a route pattern source string
 *
 * @param source The pattern source, e.g. `'/users/:id'` or `'https://:tenant.example.com/dashboard?tab'`.
 * @returns The parsed pattern.
 * @throws {ParseError} When the source is malformed.
 */
export function parsePattern<source extends string>(source: source): RoutePattern<source> {
  // Fast path for pathname-only patterns (avoids split object, Span tuples, and options wrapper)
  if (source.indexOf('?') === -1 && source.indexOf('://') === -1) {
    let start = source.charCodeAt(0) === 47 ? 1 : 0
    return createRoutePattern<source>({
      protocol: null,
      hostname: null,
      port: null,
      pathname:
        start === source.length
          ? emptyPathname
          : parsePartSpan(source, start, source.length, 'pathname'),
      search: emptySearch,
    })
  }

  let spans = split(source)
  if (spans.port && !spans.hostname) {
    throw new ParseError('missing hostname', source, spans.port[0] - 1)
  }

  return createRoutePattern<source>({
    protocol: parseProtocol(source, spans.protocol),
    hostname: parseHostname(source, spans.hostname),
    port: spans.port ? source.slice(...spans.port) : null,
    pathname: spans.pathname
      ? parsePartSpan(source, spans.pathname[0], spans.pathname[1], 'pathname')
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
  return parsePartSpan(source, start, end, options.type)
}

function parsePartSpan(
  source: string,
  start: number,
  end: number,
  type: 'hostname' | 'pathname',
): PartPattern {
  let separatorCode = type === 'hostname' ? 46 : 47 // '.' or '/'

  let tokens: Array<Mutable<PartPatternToken>> = []
  let tokenIndices: Array<number> = []
  let optionals: Map<number, number> | null = null
  let optionalStack: Array<{ tokenIndex: number; sourceIndex: number }> | null = null
  let hasParams = false
  let emptyOptionalIndex = -1
  let i = start

  while (i < end) {
    let code = source.charCodeAt(i)

    if (code === separatorCode) {
      tokens.push(separatorToken)
      tokenIndices.push(i)
      i += 1
      continue
    }

    if (code === 40) {
      optionalStack ??= []
      optionalStack.push({ tokenIndex: tokens.length, sourceIndex: i })
      tokens.push(openOptionalToken)
      tokenIndices.push(i)
      i += 1
      continue
    }

    if (code === 41) {
      let optional = optionalStack?.pop()
      if (optional === undefined) {
        throw new ParseError('unmatched )', source, i)
      }
      if (optional.tokenIndex === tokens.length - 1 && emptyOptionalIndex === -1) {
        emptyOptionalIndex = optional.sourceIndex
      }
      optionals ??= new Map()
      optionals.set(optional.tokenIndex, tokens.length)
      tokens.push(closeOptionalToken)
      tokenIndices.push(i)
      i += 1
      continue
    }

    if (code === 58 || code === 42) {
      let nameStart = i + 1
      let nameEnd = readIdentifierEnd(source, nameStart, end)
      if (code === 58) {
        if (nameEnd === nameStart) {
          throw new ParseError('missing variable name', source, i)
        }
        tokens.push({ type: ':', name: source.slice(nameStart, nameEnd) })
      } else {
        tokens.push({
          type: '*',
          name: nameEnd === nameStart ? '*' : source.slice(nameStart, nameEnd),
        })
      }
      tokenIndices.push(i)
      hasParams = true
      i = nameEnd
      continue
    }

    if (code === 92) {
      if (i + 1 === end) {
        throw new ParseError('dangling escape', source, i)
      }
      appendTextToken(tokens, tokenIndices, source.slice(i + 1, i + 2), i)
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
    appendTextToken(tokens, tokenIndices, source.slice(textStart, i), textStart)
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

  return { tokens, optionals: resolvedOptionals, type }
}

function appendTextToken(
  tokens: Array<Mutable<PartPatternToken>>,
  tokenIndices: Array<number>,
  text: string,
  sourceIndex: number,
): void {
  let lastToken = tokens[tokens.length - 1]
  if (lastToken !== undefined && lastToken.type === 'text') {
    lastToken.text += text
  } else {
    tokens.push({ type: 'text', text })
    tokenIndices.push(sourceIndex)
  }
}

function readIdentifierEnd(source: string, start: number, end: number): number {
  if (start >= end || !isIdentifierStart(source.charCodeAt(start))) return start
  let i = start + 1
  while (i < end) {
    let code = source.charCodeAt(i)
    if (!isIdentifierStart(code) && (code < 48 || code > 57)) break
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

function validateTokenGrammar(
  source: string,
  tokens: ReadonlyArray<PartPatternToken>,
  optionals: ReadonlyMap<number, number>,
  tokenIndices: ReadonlyArray<number>,
): void {
  for (let index = 0; index < tokens.length; index++) {
    let token = tokens[index]
    if (token.type !== ':' && token.type !== '*') continue

    // Fast path: skip closing ')' boundaries (never branch) before checking next token
    let nextIndex = index + 1
    while (nextIndex < tokens.length && tokens[nextIndex].type === ')') {
      nextIndex += 1
    }
    let immediate = tokens[nextIndex]
    if (immediate === undefined || immediate.type === 'separator') continue
    if (immediate.type !== '(') {
      if (token.type === '*') {
        if (immediate.type === '*') {
          throw new ParseError('adjacent wildcards', source, tokenIndices[nextIndex])
        }
        continue
      }
      if (
        immediate.type === '*' ||
        (immediate.type === 'text' && immediate.text.charCodeAt(0) === 46)
      ) {
        continue
      }
      throw new ParseError('invalid param delimiter', source, tokenIndices[nextIndex])
    }

    for (let next of nextConsumingTokenIndices(tokens, optionals, nextIndex)) {
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
    let index = pending.pop()!
    if (visited.has(index)) continue
    visited.add(index)

    let token = tokens[index]
    if (token === undefined) {
      result.add(tokens.length)
    } else if (token.type === '(') {
      pending.push(index + 1, optionals.get(index)! + 1)
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
    let nextEnd = optionals.get(nextBegin)!

    if (hasAmbiguousOptionalCaptures(tokens, begin + 1, end, nextBegin + 1, nextEnd)) {
      throw new ParseError('ambiguous optional captures', source, tokenIndices[nextBegin])
    }
  }
}

function hasAmbiguousOptionalCaptures(
  tokens: ReadonlyArray<PartPatternToken>,
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  let len = aEnd - aStart
  if (len !== bEnd - bStart) return false

  let captureNamesDiffer = false
  for (let i = 0; i < len; i++) {
    let a = tokens[aStart + i]
    let b = tokens[bStart + i]
    if (a.type !== b.type) return false
    if (a.type === 'text' && a.text !== (b as typeof a).text) return false
    if ((a.type === ':' || a.type === '*') && a.name !== (b as typeof a).name) {
      captureNamesDiffer = true
    }
  }
  return captureNamesDiffer
}

function parseProtocol(source: string, span: Span | null): RoutePatternParts['protocol'] {
  if (!span) return null
  let protocol = source.slice(...span)
  if (protocol === 'http' || protocol === 'https' || protocol === 'http(s)') return protocol
  throw new ParseError('invalid protocol', source, span[0])
}

function parseHostname(source: string, span: Span | null): RoutePatternParts['hostname'] {
  if (!span) return null
  let part = parsePartSpan(source, span[0], span[1], 'hostname')
  if (part.tokens.length === 1 && part.tokens[0].type === '*' && part.tokens[0].name === '*') {
    return null
  }
  return part
}

function parseSearch(source: string): RoutePatternParts['search'] {
  let constraints = new Map<string, Set<string>>()

  for (let [key, value] of new URLSearchParams(source)) {
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
