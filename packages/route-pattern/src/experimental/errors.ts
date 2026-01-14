import type { RoutePattern } from './route-pattern/route-pattern.ts'
import * as Variant from './variant.ts'

type ParseErrorType = 'unmatched (' | 'unmatched )' | 'missing variable name' | 'dangling escape'

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
      part: 'protocol' | 'hostname' | 'pathname'
      params: Record<string, string | number>
    }
  | {
      type: 'missing-search-params'
      pattern: RoutePattern
      missingParams: string[]
      searchParams: Record<string, string | number | Array<string | number>>
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
      let partPattern = details.pattern.ast[details.part]
      let variants = partPattern.variants.map((variant) => {
        let key = Variant.toString(variant.tokens, partPattern.paramNames)
        let missing = new Set(variant.requiredParams.filter((p) => !paramNames.includes(p)))
        return `  - ${key || '<empty>'} (missing: ${Array.from(missing).join(', ')})`
      })
      let partTitle = details.part.charAt(0).toUpperCase() + details.part.slice(1)
      return `missing params\n\nPattern: ${pattern}\nParams: ${JSON.stringify(details.params)}\n${partTitle} variants:\n${variants.join('\n')}`
    }

    unreachable(details)
  }
}

export function unreachable(value?: never): never {
  let message = value === undefined ? 'Unreachable' : `Unreachable: ${value}`
  throw new Error(message)
}
