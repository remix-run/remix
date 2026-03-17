import { jsx } from './jsx.ts'
import type { RemixElement } from './jsx.ts'

/**
 * Creates a Remix virtual element from a JSX-like call signature.
 *
 * @param type Host tag or component function.
 * @param props Element props.
 * @param children Child nodes.
 * @returns A Remix virtual element.
 */
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
