type Rank = Array<string>
export type Type = Rank

export function lessThan(a: Rank, b: Rank): boolean {
  return compare(a, b) === -1
}

export function compare(a: Rank, b: Rank): -1 | 0 | 1 {
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
