import { jsx } from './jsx.ts'
import type { RemixElement } from './jsx.ts'

export function createElement(
  type: string,
  props?: Record<string, any>,
  ...children: any[]
): RemixElement {
  if (props?.key != null) {
    let { key, ...rest } = props
    return jsx(type, { ...rest, children }, key)
  }

  return jsx(type, { ...props, children })
}
