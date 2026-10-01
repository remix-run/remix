import type { ElementProps } from '../jsx.ts';
import type { MixinDescriptor } from './mixin.ts';
/**
 * Applies default host props unless the element already provides them explicitly.
 *
 * @param defaults Default props to apply when the element does not already define them.
 * @returns A mixin descriptor that provides default host props.
 */
export declare function attrs<node extends EventTarget = Element, defaults extends ElementProps = ElementProps>(defaults: Partial<defaults>): MixinDescriptor<node, [Partial<ElementProps>], ElementProps>;
