export type Constraints = Map<string, Set<string> | null>

export function parse(search: string): Constraints {
  let constraints: Constraints = new Map()

  for (let param of search.split('&')) {
    if (param === '') continue
    let equalIndex = param.indexOf('=')

    // `?q`
    if (equalIndex === -1) {
      let name = decodeURIComponent(param)
      if (!constraints.get(name)) {
        constraints.set(name, null)
      }
      continue
    }

    let name = decodeURIComponent(param.slice(0, equalIndex))
    let value = decodeURIComponent(param.slice(equalIndex + 1))

    // `?q=`
    if (value.length === 0) {
      if (!constraints.get(name)) {
        constraints.set(name, new Set())
      }
      continue
    }

    // `?q=1`
    let constraint = constraints.get(name)
    constraints.set(name, constraint ? constraint.add(value) : new Set([value]))
  }

  return constraints
}

// todo: URLSearchParams.get() will treat `+` as spaces!!!
// should we account for that? probably yes so that we can compare apples-to-apples in `match`

export function match(params: URLSearchParams, constraints: Constraints): boolean {
  for (let [name, constraint] of constraints) {
    if (constraint === null) {
      if (!params.has(name)) return false
      continue
    }

    let values = params.getAll(name)

    if (constraint.size === 0) {
      if (values.every((value) => value === '')) return false
      continue
    }

    for (let value of constraint) {
      if (!values.includes(value)) return false
    }
  }
  return true
}

export function join(a: Constraints | undefined, b: Constraints | undefined): Constraints {
  let result: Constraints = new Map()
  for (let [name, constraint] of a ?? []) {
    result.set(name, constraint === null ? null : new Set(constraint))
  }
  for (let [name, constraint] of b ?? []) {
    let current = result.get(name)

    if (current === null || current === undefined) {
      result.set(name, constraint === null ? null : new Set(constraint))
      continue
    }

    constraint?.forEach((value) => current.add(value))
  }
  return result
}
