/**
 * Backport of [RegExp.escape](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/escape)
 */
export const RegExp_escape = (string: string): string =>
  string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
