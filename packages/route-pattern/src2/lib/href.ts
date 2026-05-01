import type { PartPatternAST, RoutePatternAST } from './ast.ts'
import { serializePattern } from './serialize.ts'
import type { ParseParams } from './types/params.ts'
import type { Split, SplitPattern } from './types/split.ts'
import type { Simplify } from './types/utils.ts'
import { unreachable } from './unreachable.ts'

/** Tuple of arguments accepted by `toHref` for a given pattern source. */
export type HrefArgs<source extends string> = _HrefArgs<ParseHrefParams<source>>

// prettier-ignore
type _HrefArgs<params> =
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

/**
 * Generate an href from a route pattern AST and the supplied params.
 *
 * @param ast The parsed route pattern.
 * @param args Path params and optional search params.
 * @returns The generated href string.
 * @throws {RoutePatternHrefError} When the pattern requires a hostname, contains a nameless wildcard, or is missing required params.
 */
export function toHref<source extends string>(
  ast: RoutePatternAST<source>,
  ...args: HrefArgs<source>
): string {
  let [params, searchParams] = args
  searchParams ??= {}

  let hasOrigin = ast.protocol !== null || ast.hostname !== null || ast.port !== null
  let result = ''

  if (hasOrigin) {
    let protocol = ast.protocol === null || ast.protocol === 'http(s)' ? 'https' : ast.protocol

    if (ast.hostname === null) {
      throw new RoutePatternHrefError({ type: 'missing-hostname', ast })
    }
    let hostname = hrefPart(ast, ast.hostname, params ?? {})

    let port = ast.port === null ? '' : `:${ast.port}`
    result += `${protocol}://${hostname}${port}`
  }

  let pathname = hrefPart(ast, ast.pathname, params ?? {})
  result += '/' + pathname

  let search = hrefSearch(ast, searchParams)
  if (search) result += `?${search}`

  return result
}

/** Generate the partial href for a single part (hostname or pathname). */
function hrefPart(
  ast: RoutePatternAST,
  part: PartPatternAST,
  params: Record<string, unknown>,
): string {
  let separator = part.type === 'hostname' ? '.' : '/'
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
            throw new RoutePatternHrefError({ type: 'nameless-wildcard', ast })
          }
          missingParams.push(token.name)
        }
        let frame = stack.pop()!
        i = part.optionals.get(frame.begin!)! + 1
        continue
      }
      stack[stack.length - 1].href += typeof value === 'string' ? value : String(value)
      i += 1
      continue
    }
    unreachable(token.type)
  }
  if (missingParams.length > 0) {
    throw new RoutePatternHrefError({ type: 'missing-params', ast, part, missingParams, params })
  }
  if (stack.length !== 1) unreachable()
  return stack[0].href
}

/** Generate a search query string from an AST and supplied params. */
function hrefSearch(ast: RoutePatternAST, searchParams: SearchParams): string | undefined {
  let constraints = ast.search
  if (constraints.size === 0 && Object.keys(searchParams).length === 0) {
    return undefined
  }

  let urlSearchParams = new URLSearchParams()

  for (let [key, value] of Object.entries(searchParams)) {
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

type RoutePatternHrefErrorDetails =
  | { type: 'missing-hostname'; ast: RoutePatternAST }
  | {
      type: 'missing-params'
      ast: RoutePatternAST
      part: PartPatternAST
      missingParams: Array<string>
      params: Record<string, unknown>
    }
  | { type: 'nameless-wildcard'; ast: RoutePatternAST }

/** Error thrown when a route pattern cannot generate an href from the supplied args. */
export class RoutePatternHrefError extends Error {
  details: RoutePatternHrefErrorDetails

  constructor(details: RoutePatternHrefErrorDetails) {
    super(RoutePatternHrefError.message(details))
    this.name = 'RoutePatternHrefError'
    this.details = details
  }

  /** Format an error message for the given href failure details. */
  static message(details: RoutePatternHrefErrorDetails): string {
    let pattern = serializePattern(details.ast)

    if (details.type === 'missing-hostname') {
      return `pattern requires hostname\n\nPattern: ${pattern}`
    }

    if (details.type === 'nameless-wildcard') {
      return `pattern contains nameless wildcard\n\nPattern: ${pattern}`
    }

    if (details.type === 'missing-params') {
      let params = details.missingParams.map((p) => `'${p}'`).join(', ')
      return `missing param(s): ${params}\n\nPattern: ${pattern}\nParams: ${JSON.stringify(details.params)}`
    }

    unreachable(details)
  }
}
