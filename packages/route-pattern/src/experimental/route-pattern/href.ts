import type { AST } from './ast.ts'

export type Params = Record<string, string | number | Array<string | number>>

export function search(constraints: AST['search'], params: Params): string | undefined {
  if (constraints.size === 0 && Object.keys(params).length === 0) {
    return undefined
  }

  let urlSearchParams = new URLSearchParams()

  for (let [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (let v of value) {
        urlSearchParams.append(key, String(v))
      }
    } else {
      urlSearchParams.append(key, String(value))
    }
  }

  for (let [key, constraint] of constraints) {
    if (constraint === null) {
      if (key in params) continue
      urlSearchParams.append(key, '')
    } else if (constraint.size === 0) {
      if (key in params) continue
      throw new Error(`todo: [href] missing required search param '${key}'`)
    } else {
      for (let value of constraint) {
        if (urlSearchParams.getAll(key).includes(value)) continue
        urlSearchParams.append(key, value)
      }
    }
  }

  let result = urlSearchParams.toString()
  return result || undefined
}
