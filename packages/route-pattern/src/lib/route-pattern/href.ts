import { unreachable } from '../errors.ts'
import type { RoutePattern } from '../route-pattern.ts'
import type { OptionalParams, RequiredParams } from '../types/params.ts'
import type { PartPattern } from './part-pattern.ts'

type ParamValue = string | number
type Params = Record<string, ParamValue>

// prettier-ignore
export type Args<source extends string> =
  [RequiredParams<source>] extends [never] ?
    [] | [null | undefined | Record<string, any>] | [null | undefined | Record<string, any>, SearchParams] :
    [ParamsArg<source>, SearchParams] | [ParamsArg<source>]

// prettier-ignore
type ParamsArg<source extends string> =
  & Record<RequiredParams<source>, ParamValue>
  & Partial<Record<OptionalParams<source>, ParamValue | null | undefined>>
  & Record<string, unknown>

/**
 * Generate a partial href from a part pattern and params.
 *
 * @param pattern The route pattern containing the part pattern.
 * @param partPattern The part pattern to generate an href for.
 * @param params The parameters to substitute into the pattern.
 * @returns The href (URL) for the given params, or null if no variant matches.
 */
export function part(pattern: RoutePattern, partPattern: PartPattern, params: Params): string {
  let missingParams: Array<string> = []

  let stack: Array<{ begin?: number; href: string }> = [{ href: '' }]
  let i = 0
  while (i < partPattern.tokens.length) {
    let token = partPattern.tokens[i]
    if (token.type === 'text') {
      stack[stack.length - 1].href += token.text
      i += 1
      continue
    }
    if (token.type === 'separator') {
      stack[stack.length - 1].href += partPattern.separator
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
            throw new HrefError({
              type: 'nameless-wildcard',
              pattern,
            })
          }
          missingParams.push(token.name)
        }
        let frame = stack.pop()!
        i = partPattern.optionals.get(frame.begin!)! + 1
        continue
      }
      stack[stack.length - 1].href += typeof value === 'string' ? value : String(value)
      i += 1
      continue
    }
    unreachable(token.type)
  }
  if (missingParams.length > 0) {
    throw new HrefError({
      type: 'missing-params',
      pattern,
      partPattern,
      missingParams,
      params,
    })
  }
  if (stack.length !== 1) unreachable()
  return stack[0].href
}

export type SearchParams = Record<
  string,
  string | number | null | undefined | Array<string | number | null | undefined>
>

/**
 * Generate a search query string from a pattern and params.
 *
 * @param pattern the route pattern containing search constraints
 * @param searchParams the search params to include in the href
 * @returns the query string (without leading `?`), or undefined if empty
 */
export function search(pattern: RoutePattern, searchParams: SearchParams): string | undefined {
  let constraints = pattern.ast.search
  if (constraints.size === 0 && Object.keys(searchParams).length === 0) {
    return undefined
  }

  let urlSearchParams = new URLSearchParams()

  for (let [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (let v of value) {
        if (v != null) {
          urlSearchParams.append(key, String(v))
        }
      }
    } else if (value != null) {
      urlSearchParams.append(key, String(value))
    }
  }

  let missingParams: Array<string> = []
  for (let [key, constraint] of constraints) {
    if (constraint === null) {
      if (key in searchParams) continue
      urlSearchParams.append(key, '')
    } else if (constraint.size === 0) {
      if (key in searchParams) continue
      missingParams.push(key)
    } else {
      for (let value of constraint) {
        if (urlSearchParams.getAll(key).includes(value)) continue
        urlSearchParams.append(key, value)
      }
    }
  }

  if (missingParams.length > 0) {
    throw new HrefError({
      type: 'missing-search-params',
      pattern,
      missingParams,
      searchParams: searchParams,
    })
  }

  let result = urlSearchParams.toString()
  return result || undefined
}

type HrefErrorDetails =
  | {
      type: 'missing-hostname'
      pattern: RoutePattern
    }
  | {
      type: 'missing-params'
      pattern: RoutePattern
      partPattern: PartPattern
      missingParams: Array<string>
      params: Record<string, string | number>
    }
  | {
      type: 'missing-search-params'
      pattern: RoutePattern
      missingParams: Array<string>
      searchParams: SearchParams
    }
  | {
      type: 'nameless-wildcard'
      pattern: RoutePattern
    }

export class HrefError extends Error {
  details: HrefErrorDetails

  constructor(details: HrefErrorDetails) {
    let message = HrefError.message(details)

    super(message)
    this.name = 'HrefError'
    this.details = details
  }

  static message(details: HrefErrorDetails): string {
    let pattern = details.pattern.toString()

    if (details.type === 'missing-hostname') {
      return `pattern requires hostname\n\nPattern: ${pattern}`
    }

    if (details.type === 'nameless-wildcard') {
      return `pattern contains nameless wildcard\n\nPattern: ${pattern}`
    }

    if (details.type === 'missing-search-params') {
      let params = details.missingParams.map((p) => `'${p}'`).join(', ')
      let searchParamsStr = JSON.stringify(details.searchParams)
      return `missing required search param(s): ${params}\n\nPattern: ${pattern}\nSearch params: ${searchParamsStr}`
    }

    if (details.type === 'missing-params') {
      let params = details.missingParams.map((p) => `'${p}'`).join(', ')
      return `missing param(s): ${params}\n\nPattern: ${pattern}\nParams: ${JSON.stringify(details.params)}`
    }

    unreachable(details)
  }
}
