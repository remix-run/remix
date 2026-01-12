import type { RoutePattern } from './route-pattern/route-pattern.ts'

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
      return `pattern requires hostname\n\n${pattern}`
    }

    if (details.type === 'nameless-wildcard') {
      return `pattern contains nameless wildcard\n\n${pattern}`
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
        let key = variant.key
        for (let paramName of variant.paramNames) {
          key = key.replace(/\{[:*]\}/, (match) => {
            return match === '{:}' ? `:${paramName}` : `*${paramName}`
          })
        }
        let missing = new Set(variant.paramNames.filter((p) => !paramNames.includes(p)))
        return `  - ${key || '<empty>'} (missing: ${Array.from(missing).join(', ')})`
      })
      let paramsStr = JSON.stringify(details.params)
      return `missing params for ${details.part}\n\nPattern: ${pattern}\nParams: ${paramsStr}\nVariants for ${details.part}:\n${variants.join('\n')}`
    }

    unreachable(details)
  }
}

export function unreachable(value: never): never {
  throw new Error(`Unreachable: ${value}`)
}
