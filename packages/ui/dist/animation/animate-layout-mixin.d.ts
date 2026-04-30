import type { ElementProps } from '../runtime/jsx.ts';
import type { MixinDescriptor } from '../runtime/mixins/mixin.ts';
import type { LayoutAnimationConfig } from '../runtime/dom.ts';
type LayoutConfig = true | false | null | undefined | LayoutAnimationConfig;
/**
 * Animates layout changes for an element using FLIP-style transforms.
 *
 * @param config Layout animation configuration.
 * @returns A mixin descriptor for the target element.
 */
export declare function animateLayout<target extends EventTarget = Element>(config?: LayoutConfig): MixinDescriptor<target, [LayoutConfig?], ElementProps>;
export {};
