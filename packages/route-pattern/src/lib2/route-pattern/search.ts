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

export function equal(a: Constraints, b: Constraints): boolean {
  if (a.size !== b.size) return false
  for (let [name, aConstraint] of a) {
    let bConstraint = b.get(name)
    if (aConstraint === null) {
      if (bConstraint !== null) return false
      continue
    }
    if (bConstraint === null || bConstraint === undefined) return false
    if (aConstraint.size !== bConstraint.size) return false
    for (let value of aConstraint) {
      if (!bConstraint.has(value)) return false
    }
  }
  return true
}

type Rank = [value: number, assigned: number, key: number]

export function compare(a: Constraints, b: Constraints): number {
  let aRank = rank(a)
  let bRank = rank(b)
  for (let i = 0; i < aRank.length; i++) {
    if (aRank[i] !== bRank[i]) return aRank[i] - bRank[i]
  }
  return 0
}

function rank(constraints: Constraints): Rank {
  let exactValue = 0
  let anyValue = 0
  let key = 0

  for (let constraint of constraints.values()) {
    if (constraint === null) {
      key -= 1
      continue
    }
    if (constraint.size === 0) {
      anyValue -= 1
      continue
    }
    exactValue -= constraint.size
  }

  return [exactValue, anyValue, key]
}
