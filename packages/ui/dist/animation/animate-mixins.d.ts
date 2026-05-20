import type { ElementProps } from '../runtime/jsx.ts';
import type { MixinDescriptor } from '../runtime/mixins/mixin.ts';
type AnimateTiming = {
    duration: number;
    easing?: string;
    delay?: number;
    composite?: CompositeOperation;
    initial?: boolean;
};
type AnimateStyleProps = {
    [property: string]: unknown;
};
export type AnimateMixinConfig = AnimateTiming & AnimateStyleProps;
type AnimationConfig = true | false | null | undefined | AnimateMixinConfig;
/**
 * Animates an element when it is inserted into the DOM.
 *
 * @param config Entrance animation configuration.
 * @returns A mixin descriptor for the target element.
 */
export declare function animateEntrance<target extends EventTarget = Element>(config?: AnimationConfig): MixinDescriptor<target, [AnimationConfig], ElementProps>;
/**
 * Animates an element when it is removed from the DOM.
 *
 * @param config Exit animation configuration.
 * @returns A mixin descriptor for the target element.
 */
export declare function animateExit<target extends EventTarget = Element>(config?: AnimationConfig): MixinDescriptor<target, [AnimationConfig], ElementProps>;
export {};
