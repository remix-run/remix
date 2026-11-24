import { RoutePattern, type RoutePatternParts, type PartPattern } from './route-pattern.ts'
import type { ParseParams } from './types/params.ts'
import type { Split, SplitPattern } from './types/split.ts'
import type { Simplify } from './types/utils.ts'
import { unreachable } from './unreachable.ts'

/** Tuple of arguments accepted by `createHref` for a given pattern source. */
export type CreateHrefArgs<source extends string> =
  ParseHrefParams<source> extends infer params
    ? [params] extends [never]
      ? never
      : _CreateHrefArgs<params>
    : never

// oxfmt-ignore
type _CreateHrefArgs<params> =
  {} extends params ?
    [params?: Simplify<params & Record<string, unknown>> | null | undefined, options?: CreateHrefOptions]
  :
  [params: Simplify<params & Record<string, unknown>>, options?: CreateHrefOptions]

/** Search parameters accepted by {@link createHref}. */
export type CreateHrefSearchParams =
  | URLSearchParams
  | Record<string, string | number | null | undefined | Array<string | number | null | undefined>>

/** Options for href generation. */
export interface CreateHrefOptions {
  /** Absolute URL used to generate a path-relative href for same-origin targets. */
  baseURL?: string | URL

  /** Search parameters to include before applying constraints from the route pattern. */
  searchParams?: CreateHrefSearchParams
}

// oxfmt-ignore
type ParseHrefParams<source extends string> =
  Split<source> extends infer split ?
    split extends never ? never :
    split extends SplitPattern ?
    split extends ({ protocol: string, hostname: undefined } | { hostname: undefined, port: string }) ? never :
    ParseParams<source> extends infer params extends Record<string, string | undefined> ?
      params extends { '*': string } ? never :
      Optionalize<Omit<params, '*'>>
    :
    never :
    never
  :
  never

// oxfmt-ignore
type Optionalize<record extends Record<string, string | undefined>> =
  & { [key in keyof record as undefined extends record[key] ? never : key]: string | number }
  & { [key in keyof record as undefined extends record[key] ? key : never]?: string | number | null | undefined }

/**
 * Generate an href from a route pattern and the supplied params.
 *
 * Pathname variables cannot produce standalone `.` or `..` segments. Pathname wildcard values
 * cannot contain these segments. Generated pathnames have one leading slash and preserve internal
 * and trailing slashes.
 *
 * @param pattern The parsed route pattern.
 * @param args Path params and href options.
 * @returns The generated href string.
 * @throws {CreateHrefError} When the pattern requires a hostname, contains a nameless wildcard,
 * is missing required params, or receives invalid params.
 * @throws {TypeError} When `baseURL` is not absolute or cannot resolve a same-origin target.
 */
export function createHref<source extends string>(
  pattern: source | RoutePattern<source>,
  ...args: CreateHrefArgs<source>
): string {
  pattern = typeof pattern === 'string' ? RoutePattern.parse(pattern) : pattern
  let patternParts = pattern._parts
  let [params, options] = args

  let hasOrigin =
    patternParts.protocol !== null || patternParts.hostname !== null || patternParts.port !== null
  let targetOrigin: string | undefined

  if (hasOrigin) {
    let protocol =
      patternParts.protocol === null || patternParts.protocol === 'http(s)'
        ? 'https'
        : patternParts.protocol

    if (patternParts.hostname === null) {
      throw new CreateHrefError({ type: 'missing-hostname', pattern })
    }
    let hostname = hrefPart(pattern, patternParts.hostname, params ?? {})

    let port = patternParts.port === null ? '' : `:${patternParts.port}`
    targetOrigin = `${protocol}://${hostname}${port}`
  }

  let variables: Array<PathnameVariable> = []
  let renderedPathname = hrefPart(pattern, patternParts.pathname, params ?? {}, variables)
  let pathname = '/' + renderedPathname.replace(/^\/+/, '')

  let search = hrefSearch(patternParts.search, options?.searchParams)
  let searchSuffix = search === undefined ? '' : `?${search}`

  let pathnameProtocol = 'https:'
  let relativePrefixLength = 0
  if (options?.baseURL !== undefined) {
    let baseURL = new URL(options.baseURL)
    let baseOrigin = baseURL.origin
    let targetURLOrigin = targetOrigin === undefined ? baseOrigin : new URL(targetOrigin).origin
    if (targetURLOrigin === baseOrigin) {
      // Absolute URLs such as `mailto:` cannot resolve relative references.
      new URL('/', baseURL)
      let relative = relativeHref(pathname, baseURL)
      pathname = relative.pathname
      relativePrefixLength = relative.prefixLength
      pathnameProtocol = baseURL.protocol
      targetOrigin = undefined
    }
  }

  let href = pathname + searchSuffix
  // Relative formatting replaces a prefix and preserves the rest of the rendered path.
  rejectVariableDotSegments(
    pattern,
    variables,
    href,
    pathname.length - renderedPathname.length,
    relativePrefixLength,
    pathnameProtocol,
  )
  return (targetOrigin ?? '') + href
}

function relativeHref(pathname: string, baseURL: URL): { pathname: string; prefixLength: number } {
  let baseSegments = pathnameSegments(baseURL.pathname)
  if (!baseURL.pathname.endsWith('/')) baseSegments.pop()

  let targetSegments = pathnameSegments(pathname)
  let targetIsDirectory = pathname.endsWith('/')
  let targetFile = targetIsDirectory ? undefined : targetSegments.pop()

  let common = 0
  while (
    common < baseSegments.length &&
    common < targetSegments.length &&
    baseSegments[common] === targetSegments[common]
  ) {
    common += 1
  }

  let relativeSegments = [
    ...Array.from({ length: baseSegments.length - common }, () => '..'),
    ...targetSegments.slice(common),
  ]
  if (targetFile !== undefined) relativeSegments.push(targetFile)

  let result = relativeSegments.join('/')
  if (targetIsDirectory) result = result === '' ? './' : `${result}/`
  if (result === '') result = './'
  let prefixLength = (baseSegments.length - common) * '../'.length
  if (/^[\\/]/.test(result) || /^[^/]*:/.test(result)) {
    result = `./${result}`
    prefixLength += './'.length
  }
  return { pathname: result, prefixLength }
}

function pathnameSegments(pathname: string): Array<string> {
  let segments = pathname.slice(1).split('/')
  if (pathname.endsWith('/')) segments.pop()
  return segments
}

type PathnameVariable = { offset: number; name: string; value: string }

function hrefPart(
  pattern: RoutePattern,
  part: PartPattern,
  params: Record<string, unknown>,
  variables?: Array<PathnameVariable>,
): string {
  let separator = part.type === 'hostname' ? '.' : '/'
  let missingParams: Array<string> = []

  let href = ''
  let stack: Array<{ begin: number; offset: number; variableCount: number }> = []
  let i = 0
  while (i < part.tokens.length) {
    let token = part.tokens[i]
    if (token.type === 'text') {
      href += token.text
      i += 1
      continue
    }
    if (token.type === 'separator') {
      href += separator
      i += 1
      continue
    }
    if (token.type === '(') {
      stack.push({ begin: i, offset: href.length, variableCount: variables?.length ?? 0 })
      i += 1
      continue
    }
    if (token.type === ')') {
      stack.pop()
      i += 1
      continue
    }
    if (token.type === ':' || token.type === '*') {
      let value = params[token.name]
      if (value == null) {
        let frame = stack.pop()
        if (frame === undefined) {
          if (token.name === '*') {
            throw new CreateHrefError({ type: 'nameless-wildcard', pattern })
          }
          if (!missingParams.includes(token.name)) missingParams.push(token.name)
          i += 1
          continue
        }
        href = href.slice(0, frame.offset)
        if (variables) variables.length = frame.variableCount
        i = part.optionals.get(frame.begin)! + 1
        if (
          href.length > (stack.at(-1)?.offset ?? 0) &&
          href.endsWith(separator) &&
          part.tokens[i]?.type === 'separator'
        ) {
          i += 1
        }
        continue
      }
      if (part.type === 'pathname' && token.type === ':') {
        let serialized = String(value)
        // The variable may supply part of an encoded dot next to literal pattern text.
        if (variables && /^[.2e]{1,6}$/i.test(serialized)) {
          variables.push({ offset: href.length, name: token.name, value: serialized })
        }
        href += encodePathnameVariableParam(pattern, token.name, serialized)
      } else if (part.type === 'pathname') {
        href += encodePathnameWildcard(value)
      } else if (token.type === ':') {
        href += validateHostnameVariable(value)
      } else {
        href += validateHostnameWildcard(value)
      }
      i += 1
      continue
    }
    unreachable(token.type)
  }
  if (missingParams.length > 0) {
    throw new CreateHrefError({
      type: 'missing-params',
      pattern,
      missingParams,
      params,
    })
  }
  if (stack.length !== 0) unreachable()

  return href
}

function rejectVariableDotSegments(
  pattern: RoutePattern,
  variables: Array<PathnameVariable>,
  href: string,
  offset: number,
  relativePrefixLength: number,
  protocol: string,
): void {
  if (variables.length === 0) return

  // Keep offsets from the rendered href while applying the URL parser's whitespace rules.
  let end = href.length
  while (end > 0 && href.charCodeAt(end - 1) <= 0x20) end -= 1
  let pathname = href.slice(0, end).split(/[?#]/, 1)[0]
  let segmentPattern = /^(?:file|ftp|https?|wss?):$/.test(protocol) ? /[^/\\]+/g : /[^/]+/g
  let variableIndex = 0
  for (let match of pathname.matchAll(segmentPattern)) {
    let start = match.index
    if (start < relativePrefixLength) continue
    while (variableIndex < variables.length && variables[variableIndex].offset + offset < start) {
      variableIndex += 1
    }
    let variable = variables[variableIndex]
    if (variable === undefined) break
    if (variable.offset + offset >= start + match[0].length) continue

    let segment = start === 0 ? match[0].replace(/^[\u0000-\u0020]+/, '') : match[0]
    segment = segment.replace(/[\t\n\r]/g, '')
    if (/^(?:\.|%2e){1,2}$/i.test(segment)) {
      throw new CreateHrefError({
        type: 'invalid-pathname-variable',
        pattern,
        paramName: variable.name,
        value: variable.value,
      })
    }
  }
}

function hrefSearch(
  constraints: RoutePatternParts['search'],
  searchParams?: CreateHrefSearchParams,
): string | undefined {
  let urlSearchParams =
    searchParams instanceof URLSearchParams
      ? new URLSearchParams(searchParams)
      : new URLSearchParams()

  if (searchParams !== undefined && !(searchParams instanceof URLSearchParams)) {
    for (let [key, value] of Object.entries(searchParams)) {
      if (Array.isArray(value)) {
        for (let v of value) {
          if (v != null) urlSearchParams.append(key, String(v))
        }
      } else if (value != null) {
        urlSearchParams.append(key, String(value))
      }
    }
  }

  for (let [key, requiredValues] of constraints) {
    if (requiredValues.size === 0) {
      if (urlSearchParams.has(key)) continue
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

/** Structured details for a {@link CreateHrefError}. */
export type CreateHrefErrorDetails =
  | { type: 'missing-hostname'; pattern: RoutePattern }
  | {
      type: 'missing-params'
      pattern: RoutePattern
      missingParams: Array<string>
      params: Record<string, unknown>
    }
  | { type: 'nameless-wildcard'; pattern: RoutePattern }
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
  | {
      type: 'invalid-pathname-variable'
      pattern: RoutePattern
      paramName: string
      value: string
    }
  | {
      type: 'invalid-pathname-wildcard'
      value: string
      segment: string
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
      return `pattern requires hostname\n\nPattern: ${details.pattern}`
    }

    if (details.type === 'nameless-wildcard') {
      return `pattern contains nameless wildcard\n\nPattern: ${details.pattern}`
    }

    if (details.type === 'missing-params') {
      let params = details.missingParams.map((p) => `'${p}'`).join(', ')
      return `missing param(s): ${params}\n\nPattern: ${details.pattern}\nParams: ${JSON.stringify(details.params)}`
    }

    if (details.type === 'invalid-hostname-variable') {
      return `invalid hostname variable param: ${JSON.stringify(details.value)} contains ${JSON.stringify(details.char)}`
    }

    if (details.type === 'invalid-hostname-wildcard') {
      return `invalid hostname wildcard param: ${JSON.stringify(details.value)} contains ${JSON.stringify(details.char)}`
    }

    if (details.type === 'invalid-pathname-variable') {
      let reason = details.value === '' ? 'cannot be empty' : 'cannot produce a dot segment'
      return `invalid pathname variable param: '${details.paramName}' ${reason}\n\nPattern: ${details.pattern}\nValue: ${JSON.stringify(details.value)}`
    }

    if (details.type === 'invalid-pathname-wildcard') {
      return `invalid pathname wildcard param: ${JSON.stringify(details.value)} contains dot segment ${JSON.stringify(details.segment)}`
    }

    unreachable(details)
  }
}

function encodePathnameVariableParam(pattern: RoutePattern, paramName: string, value: string) {
  if (value.length === 0) {
    throw new CreateHrefError({
      type: 'invalid-pathname-variable',
      pattern,
      paramName,
      value,
    })
  }
  return encodePathnameVariableSegment(value)
}

export function encodePathnameVariable(value: unknown) {
  return encodePathnameVariableSegment(String(value))
}

export function encodePathnameWildcard(value: unknown) {
  let serialized = String(value)
  return serialized
    .split('/')
    .map((segment) => {
      // Percent-encoding dots cannot preserve these segments through URL normalization.
      if (segment === '.' || segment === '..') {
        throw new CreateHrefError({ type: 'invalid-pathname-wildcard', value: serialized, segment })
      }
      return encodePathnameSegment(segment)
    })
    .join('/')
}

function encodePathnameSegment(value: string): string {
  return encodeURIComponent(value)
}

function encodePathnameVariableSegment(value: string): string {
  return encodePathnameSegment(value).replaceAll('.', '%2E')
}

/**
 * Keep hostname params from changing URL authority structure when parsed. `@` ends userinfo,
 * `:` starts the port, and `/`, `?`, and `#` start the path, query, and fragment. A backslash
 * also starts the path for special URL schemes such as HTTP and HTTPS. Hostname
 * variables also reject `.` because dots separate host labels; hostname wildcards allow `.` to
 * span labels intentionally.
 *
 * @see https://url.spec.whatwg.org/#authority-state
 * @see https://url.spec.whatwg.org/#host-parsing
 */
const HOSTNAME_PARAM_STRUCTURAL_CHARS = ['@', ':', '/', '\\', '?', '#', '%']

export function validateHostnameVariable(value: unknown): string {
  let serialized = String(value)
  for (let char of serialized) {
    if (char === '.' || isInvalidHostnameParamChar(char)) {
      throw new CreateHrefError({
        type: 'invalid-hostname-variable',
        value: serialized,
        char,
      })
    }
  }
  return serialized
}

export function validateHostnameWildcard(value: unknown): string {
  let serialized = String(value)
  for (let char of serialized) {
    if (isInvalidHostnameParamChar(char)) {
      throw new CreateHrefError({
        type: 'invalid-hostname-wildcard',
        value: serialized,
        char,
      })
    }
  }
  return serialized
}

function isInvalidHostnameParamChar(char: string): boolean {
  let code = char.charCodeAt(0)
  return code <= 0x1f || code === 0x7f || HOSTNAME_PARAM_STRUCTURAL_CHARS.includes(char)
}
