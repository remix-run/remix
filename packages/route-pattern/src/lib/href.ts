import type { PartPattern, RoutePattern } from './route-pattern.ts'
import { parsePatternParts } from './route-pattern/parse-parts.ts'
import type { ParsedRoutePattern } from './route-pattern/types.ts'
import type { ParseParams } from './types/params.ts'
import type { Split, SplitPattern } from './types/split.ts'
import type { Simplify } from './types/utils.ts'

/** Tuple of arguments accepted by `createHref` for a given pattern source. */
export type CreateHrefArgs<source extends string> = _CreateHrefArgs<ParseHrefParams<source>>

// prettier-ignore
type _CreateHrefArgs<params> =
  {} extends params ?
    [params?: Simplify<params & Record<string, unknown>> | null | undefined, searchParams?: SearchParams]
  :
  [params: Simplify<params & Record<string, unknown>>, searchParams?: SearchParams]

type SearchParams = Record<
  string,
  string | number | null | undefined | Array<string | number | null | undefined>
>

// prettier-ignore
type ParseHrefParams<source extends string> =
  Split<source> extends infer split extends SplitPattern ?
    split extends ({ protocol: string, hostname: undefined } | { hostname: undefined, port: string }) ? never :
    ParseParams<split> extends infer params extends Record<string, string | undefined> ?
      params extends { '*': string } ? never :
      Optionalize<Omit<params, '*'>>
    :
    never
  :
  never

// prettier-ignore
type Optionalize<record extends Record<string, string | undefined>> =
  & { [key in keyof record as undefined extends record[key] ? never : key]: string | number }
  & { [key in keyof record as undefined extends record[key] ? key : never]?: string | number | null | undefined }

type HrefPattern = Pick<RoutePattern, 'protocol' | 'hostname' | 'port' | 'pathname' | 'search'>

/**
 * Generate an href from a route pattern and the supplied params.
 *
 * @param pattern The parsed route pattern.
 * @param args Path params and optional search params.
 * @returns The generated href string.
 * @throws {CreateHrefError} When the pattern requires a hostname, contains a nameless wildcard, or is missing required params.
 */
export function createHref<source extends string>(
  pattern: source | RoutePattern<source>,
  ...args: CreateHrefArgs<source>
): string {
  let parsedPattern: ParsedRoutePattern
  let patternSource: string | undefined
  if (typeof pattern === 'string') {
    patternSource = pattern
    parsedPattern = parsePatternParts(pattern)
  } else {
    parsedPattern = pattern
  }
  let [params, searchParams] = args
  searchParams ??= {}

  let hasOrigin =
    parsedPattern.protocol !== null ||
    parsedPattern.hostname !== null ||
    parsedPattern.port !== null
  let result = ''

  if (hasOrigin) {
    let protocol =
      parsedPattern.protocol === null || parsedPattern.protocol === 'http(s)'
        ? 'https'
        : parsedPattern.protocol

    if (parsedPattern.hostname === null) {
      throw new CreateHrefError({
        type: 'missing-hostname',
        pattern: parsedPattern,
        source: patternSource,
      })
    }
    let hostname = hrefPart(parsedPattern, parsedPattern.hostname, params ?? {}, patternSource)

    let port = parsedPattern.port === null ? '' : `:${parsedPattern.port}`
    result += `${protocol}://${hostname}${port}`
  }

  let pathname = hrefPart(parsedPattern, parsedPattern.pathname, params ?? {}, patternSource)
  result += '/' + pathname

  let search = hrefSearch(parsedPattern, searchParams)
  if (search) result += `?${search}`

  return result
}

function hrefPart(
  pattern: ParsedRoutePattern,
  part: PartPattern,
  params: Record<string, unknown>,
  source?: string,
): string {
  let separator = part.type === 'hostname' ? '.' : '/'
  let encodeVariable = part.type === 'pathname' ? encodePathnameVariable : validateHostnameVariable
  let encodeWildcard = part.type === 'pathname' ? encodePathnameWildcard : validateHostnameWildcard
  let missingParams: Array<string> = []

  let stack: Array<{ begin?: number; href: string }> = [{ href: '' }]
  let i = 0
  while (i < part.tokens.length) {
    let token = part.tokens[i]
    if (token.type === 'text') {
      stack[stack.length - 1].href += token.text
      i += 1
      continue
    }
    if (token.type === 'separator') {
      stack[stack.length - 1].href += separator
      i += 1
      continue
    }
    if (token.type === '(') {
      stack.push({ begin: i, href: '' })
      i += 1
      continue
    }
    if (token.type === ')') {
      let frame = stack.pop()!
      stack[stack.length - 1].href += frame.href
      i += 1
      continue
    }
    if (token.type === ':' || token.type === '*') {
      let value = params[token.name]
      if (value === undefined) {
        if (stack.length <= 1) {
          if (token.name === '*') {
            throw new CreateHrefError({ type: 'nameless-wildcard', pattern, source })
          }
          missingParams.push(token.name)
        }
        let frame = stack.pop()!
        i = part.optionals.get(frame.begin!)! + 1
        continue
      }
      stack[stack.length - 1].href +=
        token.type === ':' ? encodeVariable(value) : encodeWildcard(value)
      i += 1
      continue
    }
    unreachable(token.type)
  }
  if (missingParams.length > 0) {
    throw new CreateHrefError({
      type: 'missing-params',
      pattern,
      source,
      part,
      missingParams,
      params,
    })
  }
  if (stack.length !== 1) unreachable()
  return stack[0].href
}

function hrefSearch(pattern: ParsedRoutePattern, searchParams: SearchParams): string | undefined {
  let constraints = pattern.search
  let entries = Object.entries(searchParams)
  if (constraints.size === 0 && entries.length === 0) {
    return undefined
  }

  let urlSearchParams = new URLSearchParams()

  for (let [key, value] of entries) {
    if (Array.isArray(value)) {
      for (let v of value) {
        if (v != null) urlSearchParams.append(key, String(v))
      }
    } else if (value != null) {
      urlSearchParams.append(key, String(value))
    }
  }

  for (let [key, requiredValues] of constraints) {
    if (requiredValues.size === 0) {
      if (key in searchParams) continue
      urlSearchParams.append(key, '')
    } else {
      for (let value of requiredValues) {
        if (urlSearchParams.getAll(key).includes(value)) continue
        urlSearchParams.append(key, value)
      }
    }
  }

  let result = urlSearchParams.toString()
  return result || undefined
}

type CreateHrefErrorDetails =
  | { type: 'missing-hostname'; pattern: HrefPattern; source?: string }
  | {
      type: 'missing-params'
      pattern: HrefPattern
      source?: string
      part: PartPattern
      missingParams: Array<string>
      params: Record<string, unknown>
    }
  | { type: 'nameless-wildcard'; pattern: HrefPattern; source?: string }
  | {
      type: 'invalid-hostname-variable'
      value: string
      char: string
    }
  | {
      type: 'invalid-hostname-wildcard'
      value: string
      char: string
    }

/** Error thrown when a route pattern cannot generate an href from the supplied args. */
export class CreateHrefError extends Error {
  details: CreateHrefErrorDetails

  constructor(details: CreateHrefErrorDetails) {
    super(CreateHrefError.message(details))
    this.name = 'CreateHrefError'
    this.details = details
  }

  static message(details: CreateHrefErrorDetails): string {
    if (details.type === 'missing-hostname') {
      return `pattern requires hostname\n\nPattern: ${formatPattern(details)}`
    }

    if (details.type === 'nameless-wildcard') {
      return `pattern contains nameless wildcard\n\nPattern: ${formatPattern(details)}`
    }

    if (details.type === 'missing-params') {
      let params = details.missingParams.map((p) => `'${p}'`).join(', ')
      return `missing param(s): ${params}\n\nPattern: ${formatPattern(details)}\nParams: ${JSON.stringify(details.params)}`
    }

    if (details.type === 'invalid-hostname-variable') {
      return `invalid hostname variable param: ${JSON.stringify(details.value)} contains ${JSON.stringify(details.char)}`
    }

    if (details.type === 'invalid-hostname-wildcard') {
      return `invalid hostname wildcard param: ${JSON.stringify(details.value)} contains ${JSON.stringify(details.char)}`
    }

    unreachable(details)
  }
}

function formatPattern(details: { pattern: HrefPattern; source?: string }): string {
  return details.source ?? String(details.pattern)
}

function encodePathnameVariable(value: unknown) {
  return encodePathnameSegment(String(value))
}

function encodePathnameWildcard(value: unknown) {
  return String(value).split('/').map(encodePathnameSegment).join('/')
}

/**
 * Keep pathname params from changing URL structure when parsed. `/`, `?`, and `#` are
 * path/query/fragment delimiters; `%` begins percent-encoded bytes; and `\\` is treated as a
 * path separator by special URL parsing.
 *
 * @see https://url.spec.whatwg.org/#path-percent-encode-set
 * @see https://url.spec.whatwg.org/#percent-encoded-bytes
 */
function encodePathnameSegment(value: string): string {
  return value.replace(/[/?#%\\]/g, encodeURIComponent)
}

/**
 * Keep hostname params from changing URL authority structure when parsed. `@` ends userinfo,
 * `:` starts the port, and `/`, `?`, and `#` start the path, query, and fragment. Hostname
 * variables also reject `.` because dots separate host labels; hostname wildcards allow `.` to
 * span labels intentionally.
 *
 * @see https://url.spec.whatwg.org/#authority-state
 * @see https://url.spec.whatwg.org/#host-parsing
 */
function validateHostnameVariable(value: unknown): string {
  let serialized = String(value)
  let invalid = /[.@:/?#]/.exec(serialized)
  if (invalid) {
    throw new CreateHrefError({
      type: 'invalid-hostname-variable',
      value: serialized,
      char: invalid[0],
    })
  }
  return serialized
}

function validateHostnameWildcard(value: unknown): string {
  let serialized = String(value)
  let invalid = /[@:/?#]/.exec(serialized)
  if (invalid) {
    throw new CreateHrefError({
      type: 'invalid-hostname-wildcard',
      value: serialized,
      char: invalid[0],
    })
  }
  return serialized
}

function unreachable(_value?: never): never {
  throw new Error('Unreachable')
}
