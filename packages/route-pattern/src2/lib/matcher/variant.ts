import type { PartPatternAST, PartPatternToken, RoutePatternAST } from '../ast.ts'
import { escape } from './regexp.ts'
import { unreachable } from '../unreachable.ts'
import { toRegExp } from './regexp.ts'

export type Variant = {
  readonly protocol: ProtocolVariant
  readonly hostname: HostnameVariant
  readonly port: string
  readonly pathname: PathnameVariant
}

export function generateVariants(pattern: RoutePatternAST): ReadonlyArray<Variant> {
  let result: Array<Variant> = []
  let port = pattern.port ?? ''

  for (let protocol of generateProtocolVariants(pattern.protocol)) {
    for (let hostname of generateHostnameVariants(pattern.hostname)) {
      for (let pathname of generatePathnameVariants(pattern.pathname)) {
        result.push({ protocol, hostname, port, pathname })
      }
    }
  }
  return result
}

// Protocol ----------------------------------------------------------------------------------------

type ProtocolVariant = 'http' | 'https'

function generateProtocolVariants(
  protocol: RoutePatternAST['protocol'],
): ReadonlyArray<ProtocolVariant> {
  if (protocol === null || protocol === 'http(s)') return ['http', 'https']
  return [protocol]
}

// Hostname ----------------------------------------------------------------------------------------

export type Param = Extract<PartPatternToken, { type: ':' | '*' }>

function toParams(tokens: PartVariant): ReadonlyArray<Param> {
  let params: Array<Param> = []
  for (let token of tokens) {
    if (token.type === ':' || token.type === '*') {
      params.push(token)
    }
  }
  return params
}

type HostnameVariant =
  | {
      readonly type: 'static'
      readonly value: string
    }
  | {
      readonly type: 'dynamic'
      readonly params: ReadonlyArray<Param>
      readonly regexp: RegExp
    }
  | { readonly type: 'any' }

function generateHostnameVariants(hostname: PartPatternAST | null): ReadonlyArray<HostnameVariant> {
  let result: Array<HostnameVariant> = []
  if (hostname === null) return [{ type: 'any' }]
  for (let variant of generatePartVariants(hostname)) {
    let params = toParams(variant)
    if (params.length > 0) {
      result.push({
        type: 'dynamic',
        params,
        regexp: toRegExp(variant, { separator: '.', ignoreCase: false }),
      })
    } else {
      result.push({ type: 'static', value: stringifyStatic(variant, '.') })
    }
  }
  return result
}

function stringifyStatic(variant: PartVariant, separator: string): string {
  let result = ''
  for (let token of variant) {
    if (token.type === 'text') result += token.text
    else if (token.type === 'separator') result += separator
    else throw new Error(`expected static part variant, got token type '${token.type}'`)
  }
  return result
}

// Pathname ----------------------------------------------------------------------------------------

export type PathnameVariantSegment =
  | { readonly type: 'static'; readonly key: string }
  | {
      readonly type: 'variable'
      readonly key: string
      readonly regexp: RegExp
      readonly params: ReadonlyArray<Param>
    }
  | {
      readonly type: 'wildcard'
      readonly key: string
      readonly regexp: RegExp
      readonly params: ReadonlyArray<Param>
    }

export type PathnameVariant = ReadonlyArray<PathnameVariantSegment>

// todo: anchor regexps in pathname variants with `^` and `$`

function generatePathnameVariants(
  pathname: PartPatternAST,
  options?: { ignoreCase?: boolean },
): ReadonlyArray<ReadonlyArray<PathnameVariantSegment>> {
  let result: Array<ReadonlyArray<PathnameVariantSegment>> = []
  let ignoreCase = options?.ignoreCase ?? false

  for (let tokens of generatePartVariants(pathname)) {
    let variant: Array<PathnameVariantSegment> = []
    let key = ''
    let reSource = ''
    let reFlags = ignoreCase ? 'di' : 'd'
    let type: 'static' | 'variable' | 'wildcard' = 'static'
    let params: Array<Param> = []

    for (let token of tokens) {
      if (token.type === 'separator') {
        if (type === 'static') {
          variant.push({ type: 'static', key: ignoreCase ? key.toLowerCase() : key })
          key = ''
          reSource = ''
          continue
        }
        if (type === 'variable') {
          variant.push({ type: 'variable', key, regexp: new RegExp(reSource, reFlags), params })
          key = ''
          reSource = ''
          params = []
          type = 'static'
          continue
        }
        if (type === 'wildcard') {
          key += '/'
          reSource += escape('/')
          continue
        }
        unreachable(type)
      }

      if (token.type === 'text') {
        key += token.text
        reSource += escape(token.text)
        continue
      }

      if (token.type === ':') {
        key += '{:}'
        reSource += `([^/]+)`
        params.push(token)
        if (type === 'static') type = 'variable'
        continue
      }

      if (token.type === '*') {
        key += '{*}'
        reSource += `(.*)`
        params.push(token)
        type = 'wildcard'
        continue
      }

      unreachable(token.type)
    }

    if (type === 'static') {
      variant.push({ type: 'static', key: ignoreCase ? key.toLowerCase() : key })
    }
    if (type === 'variable' || type === 'wildcard') {
      variant.push({ type, key, regexp: new RegExp(reSource, reFlags), params })
    }
    result.push(variant)
  }
  return result
}

// Part --------------------------------------------------------------------------------------------

type PartVariantToken = Exclude<PartPatternToken, { type: '(' | ')' }>
type PartVariant = ReadonlyArray<PartVariantToken>

/**
 * Expand a part pattern's optionals into the list of all concrete variants.
 *
 * Each variant is the linear token sequence you'd get by independently choosing
 * to include or omit every `(` `)` group. No nesting, no optional markers.
 */
export function generatePartVariants(part: PartPatternAST): ReadonlyArray<PartVariant> {
  let result: Array<PartVariant> = []
  let stack: Array<{ index: number; tokens: Array<PartVariantToken> }> = [{ index: 0, tokens: [] }]

  while (stack.length > 0) {
    let { index, tokens } = stack.pop()!

    if (index === part.tokens.length) {
      result.push(tokens)
      continue
    }

    let token = part.tokens[index]

    if (token.type === '(') {
      stack.push(
        { index: index + 1, tokens },
        { index: part.optionals.get(index)! + 1, tokens: tokens.slice() },
      )
      continue
    }

    if (token.type === ')') {
      stack.push({ index: index + 1, tokens })
      continue
    }

    if (
      token.type === ':' ||
      token.type === '*' ||
      token.type === 'text' ||
      token.type === 'separator'
    ) {
      tokens.push(token)
      stack.push({ index: index + 1, tokens })
      continue
    }
    unreachable(token.type)
  }
  return result
}
