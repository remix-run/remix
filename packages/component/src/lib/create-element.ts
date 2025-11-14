import { jsx } from './jsx.ts'

export function createElement(
  type: string,
  props: Record<string, any>,
  ...children: any[]
): Remix.Element {
  if (props.key != null) {
    let { key, ...rest } = props
    return jsx(type, { ...rest, children }, key)
  }

  return jsx(type, { ...props, children })
}
