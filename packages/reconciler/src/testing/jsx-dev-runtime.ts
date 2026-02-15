export { Fragment, jsx, jsxs } from './jsx-runtime.ts'
import { jsx } from './jsx-runtime.ts'
import type { ReconcilerJsxElement } from './jsx-runtime.ts'

export function jsxDEV(
  type: unknown,
  props: null | Record<string, unknown>,
  key: unknown,
  _isStaticChildren?: boolean,
  _source?: unknown,
  _self?: unknown,
): ReconcilerJsxElement {
  return jsx(type, props, key)
}
