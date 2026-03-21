import { unreachable } from '../unreachable.ts'
import type { RoutePattern } from '../route-pattern.ts'
import type { PartPattern } from './part-pattern.ts'
import type { ParseParams } from './params.ts'
import type { Split, SplitPattern } from '../types/split.ts'
import type { Simplify } from '../types/utils.ts'

// todo: `Split<source>` return { hostname: "" } instead of { hostname: undefined } which causes issues
/**
 * Tuple of arguments accepted by `RoutePattern.href()` for a given pattern.
 */
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
    split extends ({ protocol: string, hostname: undefined } | { hostname: undefined, port: string }) ? never : // missing-hostname
    ParseParams<split> extends infer params extends Record<string, string | undefined> ?
      params extends { '*': string } ? never : // nameless-wildcard
      Optionalize<Omit<params, '*'>>
    :
    never
  :
  never

// prettier-ignore
type Optionalize<record extends Record<string, string | undefined>> =
  // { name: string } -> { name: string | number }
  & { [key in keyof record as undefined extends record[key] ? never : key]: string | number }
  // { name: string | undefined } -> { name?: string | number | null | undefined }
  & { [key in keyof record as undefined extends record[key] ? key : never]?: string | number | null | undefined }

/**
 * Generate a search query string from a pattern and params.
 *
 * @param pattern the route pattern containing search constraints
 * @param searchParams the search params to include in the href
 * @returns the query string (without leading `?`), or undefined if empty
 */
export function hrefSearch(pattern: RoutePattern, searchParams: SearchParams): string | undefined {
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
      params: Record<string, unknown>
    }
  | {
      type: 'nameless-wildcard'
      pattern: RoutePattern
    }

/**
 * Error thrown when a route pattern cannot generate an href from the supplied args.
 */
export class HrefError extends Error {
  /**
   * Structured details describing why href generation failed.
   */
  details: HrefErrorDetails

  constructor(details: HrefErrorDetails) {
    let message = HrefError.message(details)

    super(message)
    this.name = 'HrefError'
    this.details = details
  }

  /**
   * Formats an error message for the given href failure details.
   *
   * @param details Structured href failure details.
   * @returns A human-readable error message.
   */
  static message(details: HrefErrorDetails): string {
    let pattern = details.pattern.toString()

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
