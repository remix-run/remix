/**
 * Backport of [RegExp.escape](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/escape)
 */
export const RegExp_escape = (string: string): string =>
  string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Backport of [Set.prototype.difference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/difference)
 */
export const Set_difference = <T>(a: Set<T>, b: Set<T>): Set<T> => {
  let result = new Set<T>()
  for (let item of a) {
    if (!b.has(item)) {
      result.add(item)
    }
  }
  return result
}
