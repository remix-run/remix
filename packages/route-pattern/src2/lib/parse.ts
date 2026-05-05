import { split, type Span } from './split.ts'
import type { PartPattern, PartPatternToken, RoutePattern } from './route-pattern.ts'

const IDENTIFIER_RE = /^[a-zA-Z_$][a-zA-Z_$0-9]*/

// todo: move this to type utils somewhere
// Distributive Mutable utility so we can build tokens in place during parsing
// and return them as the readonly public type.
type Mutable<T> = T extends unknown ? { -readonly [K in keyof T]: T[K] } : never

/**
 * Parse a route pattern source string
 *
 * @param source The pattern source, e.g. `'/users/:id'` or `'https://:tenant.example.com/dashboard?tab'`.
 * @returns The parsed pattern.
 * @throws {RoutePatternParseError} When the source is malformed.
 */
export function parsePattern<source extends string>(source: source): RoutePattern<source> {
  let spans = split(source)

  return {
    protocol: parseProtocol(source, spans.protocol),
    hostname: parseHostname(source, spans.hostname),
    port: spans.port ? source.slice(...spans.port) : null,
    pathname: spans.pathname
      ? parsePart(source, { span: spans.pathname, type: 'pathname' })
      : parsePart('', { span: [0, 0], type: 'pathname' }),
    search: spans.search ? parseSearch(source.slice(...spans.search)) : new Map(),
  }
}

/**
 * Parse a single URL part (hostname or pathname).
 *
 * Exposed for sub-exports that need to construct or transform individual parts.
 */
export function parsePart(
  source: string,
  options: { span?: Span; type: 'hostname' | 'pathname' },
): PartPattern {
  let span = options.span ?? [0, source.length]
  let separator = options.type === 'hostname' ? '.' : '/'

  let tokens: Array<Mutable<PartPatternToken>> = []
  let optionals: Map<number, number> = new Map()

  let appendText = (text: string) => {
    let currentToken = tokens.at(-1)
    if (currentToken?.type === 'text') {
      currentToken.text += text
    } else {
      tokens.push({ type: 'text', text })
    }
  }

  let i = span[0]
  let optionalStack: Array<number> = []
  while (i < span[1]) {
    let char = source[i]

    if (char === '(') {
      optionalStack.push(tokens.length)
      tokens.push({ type: char })
      i += 1
      continue
    }

    if (char === ')') {
      let begin = optionalStack.pop()
      if (begin === undefined) {
        throw new RoutePatternParseError('unmatched )', source, i)
      }
      optionals.set(begin, tokens.length)
      tokens.push({ type: char })
      i += 1
      continue
    }

    if (char === ':') {
      i += 1
      let name = IDENTIFIER_RE.exec(source.slice(i, span[1]))?.[0]
      if (!name) {
        throw new RoutePatternParseError('missing variable name', source, i - 1)
      }
      tokens.push({ type: ':', name })
      i += name.length
      continue
    }

    if (char === '*') {
      i += 1
      let name = IDENTIFIER_RE.exec(source.slice(i, span[1]))?.[0]
      tokens.push({ type: '*', name: name ?? '*' })
      i += name?.length ?? 0
      continue
    }

    if (char === separator) {
      tokens.push({ type: 'separator' })
      i += 1
      continue
    }

    if (char === '\\') {
      if (i + 1 === span[1]) {
        throw new RoutePatternParseError('dangling escape', source, i)
      }
      let text = source.slice(i, i + 2)
      appendText(text)
      i += text.length
      continue
    }

    appendText(char)
    i += 1
  }
  if (optionalStack.length > 0) {
    throw new RoutePatternParseError('unmatched (', source, optionalStack.at(-1)!)
  }

  return { tokens, optionals, type: options.type }
}

function parseProtocol(source: string, span: Span | null): RoutePattern['protocol'] {
  if (!span) return null
  let protocol = source.slice(...span)
  if (protocol === '' || protocol === 'http' || protocol === 'https' || protocol === 'http(s)') {
    return protocol === '' ? null : protocol
  }
  throw new RoutePatternParseError('invalid protocol', source, span[0])
}

function parseHostname(source: string, span: Span | null): RoutePattern['hostname'] | null {
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

function parseSearch(source: string): RoutePattern['search'] {
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

type RoutePatternParseErrorType =
  | 'unmatched ('
  | 'unmatched )'
  | 'missing variable name'
  | 'dangling escape'
  | 'invalid protocol'

/** Error thrown when a route pattern cannot be parsed. */
export class RoutePatternParseError extends Error {
  /** The parse failure category. */
  type: RoutePatternParseErrorType

  /** Original pattern source being parsed. */
  source: string

  /** Character index where parsing failed. */
  index: number

  constructor(type: RoutePatternParseErrorType, source: string, index: number) {
    let underline = ' '.repeat(index) + '^'
    let message = `${type}\n\n${source}\n${underline}`

    super(message)
    this.name = 'RoutePatternParseError'
    this.type = type
    this.source = source
    this.index = index
  }
}
