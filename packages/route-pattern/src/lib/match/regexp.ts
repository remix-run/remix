import type { PartPatternToken } from '../route-pattern.ts'
import { unreachable } from '../unreachable.ts'

/**
 * Emulates the `RegExp.escape()` available in all latest browsers and runtimes, but not in Node 22.
 * See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/escape#browser_compatibility
 *
 * @param text The text to escape.
 * @returns The escaped text.
 */
export function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')
}

export function toRegExp(
  tokens: ReadonlyArray<PartPatternToken>,
  options: {
    separator: '.' | '/'
    ignoreCase: boolean
  },
): RegExp {
  let result = ''
  for (let token of tokens) {
    if (token.type === 'text') {
      result += escape(token.text)
      continue
    }

    if (token.type === ':') {
      result += `([^${options.separator}]+?)`
      continue
    }

    if (token.type === '*') {
      result += `(.*)`
      continue
    }

    if (token.type === '(') {
      result += '(?:'
      continue
    }

    if (token.type === ')') {
      result += ')?'
      continue
    }

    if (token.type === 'separator') {
      result += escape(options.separator)
      continue
    }

    unreachable(token.type)
  }
  let flags = 'd'
  if (options.ignoreCase) flags += 'i'
  return new RegExp(`^${result}$`, flags)
}
