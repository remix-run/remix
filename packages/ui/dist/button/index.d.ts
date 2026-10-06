import type { CSSMixinDescriptor, ElementProps, MixinDescriptor } from '@remix-run/ui';
export type ButtonSize = 'md' | 'lg';
export type ButtonTone = 'neutral' | 'primary' | 'ghost';
export interface ButtonOptions {
    size?: ButtonSize;
    tone?: ButtonTone;
}
type ButtonMixin = readonly [
    MixinDescriptor<Element, [], ElementProps>,
    CSSMixinDescriptor,
    CSSMixinDescriptor,
    CSSMixinDescriptor
];
export declare function button(options?: ButtonOptions): ButtonMixin;
export default button;
