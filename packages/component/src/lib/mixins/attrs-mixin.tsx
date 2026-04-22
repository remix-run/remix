import { createMixin } from '../mixin.ts'
import type { ElementProps } from '../jsx.ts'
import type { MixinDescriptor } from '../mixin.ts'
import { createElement } from '../create-element.ts'

const attrsMixin = createMixin<Element, [defaults: ElementProps], ElementProps>(
  (handle) => (defaults, props) => {
    let nextProps = props

    for (let key in defaults) {
      if (props[key] !== undefined) continue
      if (nextProps === props) nextProps = { ...props }
      nextProps[key] = defaults[key]
    }

    return nextProps === props ? handle.element : createElement(handle.element, nextProps)
  },
)

/**
 * Applies default host props unless the element already provides them explicitly.
 *
 * @param defaults Default props to apply when the element does not already define them.
 * @returns A mixin descriptor that provides default host props.
 */
export function attrs<
  node extends EventTarget = Element,
  defaults extends ElementProps = ElementProps,
>(defaults: Partial<defaults>): MixinDescriptor<node, [Partial<ElementProps>], ElementProps> {
  return attrsMixin(defaults as ElementProps) as unknown as MixinDescriptor<
    node,
    [Partial<ElementProps>],
    ElementProps
  >
}
