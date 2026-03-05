import type { ElementProps } from '../jsx.ts';
import type { MixinDescriptor } from '../mixin.ts';
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
export declare function animateEntrance<target extends EventTarget = Element>(config?: AnimationConfig): MixinDescriptor<target, [AnimationConfig], ElementProps>;
export declare function animateExit<target extends EventTarget = Element>(config?: AnimationConfig): MixinDescriptor<target, [AnimationConfig], ElementProps>;
export {};
