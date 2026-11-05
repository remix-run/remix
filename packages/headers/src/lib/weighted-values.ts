import { parseParams } from './param-values.ts'
import { isIterable, splitList } from './utils.ts'

export type WeightedValuesInit = Iterable<string | [string, number]> | Record<string, number>

export function parseWeightedValues(value: string | WeightedValuesInit): Map<string, number> {
  let map = new Map<string, number>()

  if (typeof value === 'string') {
    for (let piece of splitList(value)) {
      let params = parseParams(piece)
      if (params.length < 1) continue

      let name = params[0][0]
      let weight = 1

      for (let i = 1; i < params.length; i++) {
        let [key, val] = params[i]
        if (key === 'q') {
          weight = Number(val)
          break
        }
      }

      map.set(name.toLowerCase(), weight)
    }
  } else if (isIterable(value)) {
    for (let item of value) {
      if (Array.isArray(item)) {
        map.set(item[0].toLowerCase(), item[1])
      } else {
        map.set(item.toLowerCase(), 1)
      }
    }
  } else {
    for (let name of Object.getOwnPropertyNames(value)) {
      map.set(name.toLowerCase(), value[name])
    }
  }

  return sortByWeight(map)
}

export function sortByWeight(map: Map<string, number>): Map<string, number> {
  return new Map([...map].sort((a, b) => b[1] - a[1]))
}

export function getPreferredValue<value extends string>(
  values: readonly value[],
  getWeight: (value: value) => number,
): value | null {
  let sorted = values.map((value) => [value, getWeight(value)] as const).sort((a, b) => b[1] - a[1])
  let first = sorted[0]

  return first !== undefined && first[1] > 0 ? first[0] : null
}

export function stringifyWeightedValues(map: Map<string, number>): string {
  let pairs: string[] = []

  for (let [name, weight] of map) {
    pairs.push(`${name}${weight === 1 ? '' : `;q=${weight}`}`)
  }

  return pairs.join(',')
}
