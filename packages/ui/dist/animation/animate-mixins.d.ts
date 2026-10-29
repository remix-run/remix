import type { ElementProps, MixinDescriptor } from '@remix-run/component';
import type { AnimationStyles, AnimationTransition, TransitionOptions } from './transition.ts';
/** Style values and transition settings for an entrance or exit animation. */
export interface AnimateMixinConfig extends Omit<AnimationStyles, 'transition'>, TransitionOptions {
    /** Per-property overrides for the animation's timing and compositing settings. */
    transition?: AnimationTransition;
    /** Skip the first keyed entrance when false (default: true). */
    initial?: boolean;
}
type AnimationConfig = true | false | null | undefined | AnimateMixinConfig;
type ExitAnimationConfig = AnimationConfig;
/**
 * Animates an element when it is inserted into the DOM.
 *
 * @param config Entrance animation configuration.
 * @returns A mixin descriptor for the target element.
 */
export declare function animateEntrance<target extends EventTarget = Element>(config?: AnimationConfig): MixinDescriptor<target, [AnimationConfig], ElementProps>;
/**
 * Animates an element when it is removed from the DOM.
 * The retained element is inert until removal or reclamation.
 *
 * @param config Exit animation configuration.
 * @returns A mixin descriptor for the target element.
 */
export declare function animateExit<target extends EventTarget = Element>(config?: ExitAnimationConfig): MixinDescriptor<target, [ExitAnimationConfig], ElementProps>;
export {};
