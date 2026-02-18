export { Fragment, jsx, jsxs } from './jsx-runtime.ts'
import { jsx } from './jsx-runtime.ts'
import type { TuiJsxElement } from './jsx-runtime.ts'

export function jsxDEV(
  type: unknown,
  props: null | Record<string, unknown>,
  key: unknown,
): TuiJsxElement {
  return jsx(type, props, key)
}
