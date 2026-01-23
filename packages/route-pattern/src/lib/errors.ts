import type { RoutePattern } from './route-pattern.ts'
import type { PartPattern } from './part-pattern.ts'
import type * as Search from './route-pattern/search.ts'

type ParseErrorType =
  | 'unmatched ('
  | 'unmatched )'
  | 'missing variable name'
  | 'dangling escape'
  | 'invalid protocol'

export class ParseError extends Error {
  type: ParseErrorType
  source: string
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

type HrefErrorDetails =
  | {
      type: 'missing-hostname'
      pattern: RoutePattern
    }
  | {
      type: 'missing-params'
      pattern: RoutePattern
      partPattern: PartPattern
      params: Record<string, string | number>
    }
  | {
      type: 'missing-search-params'
      pattern: RoutePattern
      missingParams: string[]
      searchParams: Search.HrefParams
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
      let params = details.missingParams.join(', ')
      let searchParamsStr = JSON.stringify(details.searchParams)
      return `missing required search param(s) '${params}'\n\nPattern: ${pattern}\nSearch params: ${searchParamsStr}`
    }

    if (details.type === 'missing-params') {
      let paramNames = Object.keys(details.params)
      let variants = details.partPattern.variants.map((variant) => {
        let key = variant.toString()
        let missing = new Set(variant.requiredParams.filter((p) => !paramNames.includes(p)))
        return `  - ${key || '<empty>'} (missing: ${Array.from(missing).join(', ')})`
      })
      let partTitle =
        details.partPattern.type.charAt(0).toUpperCase() + details.partPattern.type.slice(1)
      return `missing params\n\nPattern: ${pattern}\nParams: ${JSON.stringify(details.params)}\n${partTitle} variants:\n${variants.join('\n')}`
    }

    unreachable(details)
  }
}

export function unreachable(value?: never): never {
  let message = value === undefined ? 'Unreachable' : `Unreachable: ${value}`
  throw new Error(message)
}
