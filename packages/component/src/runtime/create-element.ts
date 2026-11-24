import { isRemixNode, jsx, normalizeChildren } from './core/vnode.ts'
import { invariant } from './invariant.ts'
import type { ElementProps, ElementType, RemixElement } from './core/vnode.ts'

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
  props?: ElementProps,
  ...children: unknown[]
): RemixElement {
  let nextProps = { ...(props ?? {}) }
  if (isMixinElementType(type)) {
    if (children.length > 0) {
      console.error(new Error('mixin elements must not receive children'))
    }
  } else {
    invariant(children.every(isRemixNode), 'Invalid child node')
    nextProps.children = normalizeChildren(children)
  }

  if (nextProps.key != null) {
    let { key, ...rest } = nextProps
    return jsx(type, rest, key)
  }

  return jsx(type, nextProps)
}

function isMixinElementType(
  type: ElementType,
): type is ElementType & { __rmxMixinElementType: string } {
  return typeof type === 'function' && '__rmxMixinElementType' in type
}
