import type { ElementProps } from '../jsx.ts';
import type { MixinDescriptor } from '../mixin.ts';
import type { LayoutAnimationConfig } from '../dom.ts';
type LayoutConfig = true | false | null | undefined | LayoutAnimationConfig;
/**
 * Animates layout changes for an element using FLIP-style transforms.
 *
 * @param config Layout animation configuration.
 * @returns A mixin descriptor for the target element.
 */
export declare function animateLayout<target extends EventTarget = Element>(config?: LayoutConfig): MixinDescriptor<target, [LayoutConfig?], ElementProps>;
export {};
