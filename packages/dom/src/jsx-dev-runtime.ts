export { Fragment, jsx, jsxs } from './lib/jsx/runtime.ts'
import { jsx } from './lib/jsx/runtime.ts'
import type { DomJsxElement } from './lib/jsx/runtime.ts'

export function jsxDEV(
  type: unknown,
  props: null | Record<string, unknown>,
  key: unknown,
): DomJsxElement {
  return jsx(type, props, key)
}
