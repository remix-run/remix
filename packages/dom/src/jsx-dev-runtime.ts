export { Fragment, jsx, jsxs } from './jsx-runtime.ts'
import { jsx } from './jsx-runtime.ts'
import type { DomJsxElement } from './jsx-runtime.ts'

export function jsxDEV(
  type: unknown,
  props: null | Record<string, unknown>,
  key: unknown,
): DomJsxElement {
  return jsx(type, props, key)
}
