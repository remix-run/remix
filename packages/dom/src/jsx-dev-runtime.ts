export { Fragment, jsx, jsxs } from './lib/jsx.ts'
import { jsx } from './lib/jsx.ts'
import type { DomJsxElement } from './lib/jsx.ts'

export function jsxDEV(
  type: unknown,
  props: null | Record<string, unknown>,
  key: unknown,
): DomJsxElement {
  return jsx(type, props, key)
}
