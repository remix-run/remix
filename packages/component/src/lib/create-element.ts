import { jsx } from './jsx.ts'
import type { ElementType, RemixElement } from './jsx.ts'

/**
 * Creates a Remix virtual element from a JSX-like call signature.
 *
 * @param type Host tag, component function, or mixin host placeholder.
 * @param props Element props.
 * @param children Child nodes.
 * @returns A Remix virtual element.
 */
export function createElement(
  type: ElementType,
  props?: Record<string, any>,
  ...children: any[]
): RemixElement {
  let nextProps = { ...(props ?? {}) }
  if (isMixinElementType(type)) {
    if (children.length > 0) {
      console.error(new Error('mixin elements must not receive children'))
    }
  } else {
    nextProps.children = children
  }

  if (nextProps.key != null) {
    let { key, ...rest } = nextProps
    return jsx(type, rest, key)
  }

  return jsx(type, nextProps)
}

function isMixinElementType(
  type: ElementType,
): type is ((...args: unknown[]) => unknown) & { __rmxMixinElementType: string } {
  return typeof type === 'function' && '__rmxMixinElementType' in type
}
