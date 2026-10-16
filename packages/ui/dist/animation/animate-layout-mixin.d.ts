import type { ElementProps, LayoutAnimationConfig, MixinDescriptor } from '@remix-run/component';
type LayoutConfig = true | false | null | undefined | LayoutAnimationConfig;
/**
 * Animates layout changes for an element using FLIP-style transforms.
 *
 * @param config Layout animation configuration.
 * @returns A mixin descriptor for the target element.
 */
export declare function animateLayout<target extends EventTarget = Element>(config?: LayoutConfig): MixinDescriptor<target, [LayoutConfig?], ElementProps>;
export {};
