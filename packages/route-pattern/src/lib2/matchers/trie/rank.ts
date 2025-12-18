import * as RoutePattern from '../../route-pattern/index.ts'

type Rank = {
  hierarchical: Array<string>
  search: RoutePattern.Search.Constraints
}

export function lessThan(a: Rank, b: Rank): boolean {
  return compare(a, b) === -1
}

export function compare(a: Rank, b: Rank): number {
  let hierarchical = compareHierarchical(a.hierarchical, b.hierarchical)
  if (hierarchical !== 0) return hierarchical
  return RoutePattern.Search.compare(a.search, b.search)
}

function compareHierarchical(a: Rank['hierarchical'], b: Rank['hierarchical']): -1 | 0 | 1 {
  for (let i = 0; i < a.length; i++) {
    let segmentA = a[i]
    let segmentB = b[i]
    if (segmentA < segmentB) return -1
    if (segmentA > segmentB) return 1
  }
  if (a.length < b.length) return -1
  if (a.length > b.length) return 1
  return 0
}
