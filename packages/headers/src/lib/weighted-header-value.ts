import { type HeaderValue } from './header-value.ts'
import { parseParams } from './param-values.ts'
import { isIterable, splitList } from './utils.ts'

/**
 * Initializer for a header value that is a list of weighted (quality) values.
 */
export type WeightedHeaderValueInit = Iterable<string | [string, number]> | Record<string, number>

/**
 * Compares a lowercase header range (such as `text/*`) with a lowercase requested value (such as
 * `text/html`). Returns `null` when the range does not match, otherwise its specificity: when more
 * than one range matches, the most specific one determines the weight.
 */
type RangeMatcher = (range: string, value: string) => number | null

/**
 * Shared implementation of headers like `Accept` that hold a list of values with quality weights,
 * kept in preference order.
 */
export class WeightedHeaderValue implements HeaderValue, Iterable<[string, number]> {
  #map = new Map<string, number>()
  #match: RangeMatcher

  constructor(init: string | WeightedHeaderValueInit | null | undefined, match: RangeMatcher) {
    this.#match = match

    if (init == null) return

    if (typeof init === 'string') {
      for (let piece of splitList(init)) {
        let params = parseParams(piece)
        if (params.length < 1) continue

        let value = params[0][0]
        let weight = 1

        for (let i = 1; i < params.length; i++) {
          let [key, val] = params[i]
          if (key === 'q') {
            weight = Number(val)
            break
          }
        }

        this.#map.set(value.toLowerCase(), weight)
      }
    } else if (isIterable(init)) {
      for (let item of init) {
        if (Array.isArray(item)) {
          this.#map.set(item[0].toLowerCase(), item[1])
        } else {
          this.#map.set(item.toLowerCase(), 1)
        }
      }
    } else {
      for (let value of Object.getOwnPropertyNames(init)) {
        this.#map.set(value.toLowerCase(), init[value])
      }
    }

    this.#sort()
  }

  #sort() {
    this.#map = new Map([...this.#map].sort((a, b) => b[1] - a[1]))
  }

  /**
   * An array of all weights (q values) in the header.
   */
  get weights(): number[] {
    return Array.from(this.#map.values())
  }

  /**
   * The number of values in the header.
   */
  get size(): number {
    return this.#map.size
  }

  /**
   * Returns `true` if the header matches the given value (i.e. it is "acceptable").
   *
   * @param value The value to check
   * @returns `true` if the value is acceptable, `false` otherwise
   */
  accepts(value: string): boolean {
    return this.getWeight(value) > 0
  }

  /**
   * Gets the weight of a value, matching it against wildcard and partial ranges in the header. When
   * several ranges match, the most specific one wins, so `gzip;q=0, *` gives `gzip` a weight of `0`.
   *
   * @param value The value to get
   * @returns The weight of the value, or `0` if it is not in the header
   */
  getWeight(value: string): number {
    let lower = value.toLowerCase()
    let bestSpecificity = -1
    let bestWeight = 0

    // Entries are sorted by weight, so ties in specificity go to the higher weight.
    for (let [range, weight] of this.#map) {
      let specificity = this.#match(range, lower)
      if (specificity !== null && specificity > bestSpecificity) {
        bestSpecificity = specificity
        bestWeight = weight
      }
    }

    return bestWeight
  }

  /**
   * Returns the most preferred value from the given list of values.
   *
   * @param values The values to choose from
   * @returns The most preferred value or `null` if none match
   */
  getPreferred<value extends string>(values: readonly value[]): value | null {
    let sorted = values
      .map((value) => [value, this.getWeight(value)] as const)
      .sort((a, b) => b[1] - a[1])

    let first = sorted[0]

    return first !== undefined && first[1] > 0 ? first[0] : null
  }

  /**
   * Gets the weight of a value. If it is not in the header verbatim, this returns `null`.
   *
   * @param value The value to get
   * @returns The weight of the value, or `null` if it is not in the header
   */
  get(value: string): number | null {
    return this.#map.get(value.toLowerCase()) ?? null
  }

  /**
   * Sets a value with the given weight.
   *
   * @param value The value to set
   * @param weight The weight of the value (default: `1`)
   */
  set(value: string, weight = 1): void {
    this.#map.set(value.toLowerCase(), weight)
    this.#sort()
  }

  /**
   * Removes the given value from the header.
   *
   * @param value The value to remove
   */
  delete(value: string): void {
    this.#map.delete(value.toLowerCase())
  }

  /**
   * Checks if the header contains a given value verbatim.
   *
   * @param value The value to check
   * @returns `true` if the value is in the header, `false` otherwise
   */
  has(value: string): boolean {
    return this.#map.has(value.toLowerCase())
  }

  /**
   * Removes all values from the header.
   */
  clear(): void {
    this.#map.clear()
  }

  /**
   * Returns an iterator of all value and weight pairs.
   *
   * @returns An iterator of `[value, weight]` tuples
   */
  entries(): IterableIterator<[string, number]> {
    return this.#map.entries()
  }

  /**
   * Iterates over value and weight pairs in preference order.
   *
   * @returns An iterator of `[value, weight]` tuples.
   */
  [Symbol.iterator](): IterableIterator<[string, number]> {
    return this.entries()
  }

  /**
   * Invokes the callback for each value and weight pair.
   *
   * @param callback The function to call for each pair
   * @param thisArg The value to use as `this` when calling the callback
   */
  forEach(callback: (value: string, weight: number, header: this) => void, thisArg?: any): void {
    for (let [value, weight] of this) {
      callback.call(thisArg, value, weight, this)
    }
  }

  /**
   * Returns the string representation of the header value.
   *
   * @returns The header value as a string
   */
  toString(): string {
    let pairs: string[] = []

    for (let [value, weight] of this.#map) {
      pairs.push(`${value}${weight === 1 ? '' : `;q=${weight}`}`)
    }

    return pairs.join(',')
  }
}
