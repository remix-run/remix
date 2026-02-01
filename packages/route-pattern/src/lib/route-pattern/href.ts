import { unreachable } from '../unreachable.ts'
import type { RoutePattern } from '../route-pattern.ts'
import type { OptionalParams, RequiredParams } from '../types/params.ts'
import type { PartPattern } from './part-pattern.ts'

type HrefParamValue = string | number
export type HrefParams = Record<string, HrefParamValue>

// prettier-ignore
export type HrefArgs<source extends string> =
  [RequiredParams<source>] extends [never] ?
    [] | [null | undefined | Record<string, any>] | [null | undefined | Record<string, any>, HrefSearchParams] :
    [HrefParamsArg<source>, HrefSearchParams] | [HrefParamsArg<source>]

// prettier-ignore
type HrefParamsArg<source extends string> =
  & Record<RequiredParams<source>, HrefParamValue>
  & Partial<Record<OptionalParams<source>, HrefParamValue | null | undefined>>
  & Record<string, unknown>

export type HrefSearchParams = Record<
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
export function hrefSearch(
  pattern: RoutePattern,
  searchParams: HrefSearchParams,
): string | undefined {
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
      searchParams: HrefSearchParams
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
