import type { CSSMixinDescriptor, ElementProps, MixinDescriptor } from '@remix-run/ui';
export type RadioSize = 'md' | 'lg';
export interface RadioOptions {
    size?: RadioSize;
}
type RadioMixin = readonly [
    MixinDescriptor<Element, [], ElementProps>,
    CSSMixinDescriptor,
    CSSMixinDescriptor
];
export declare function radio(options?: RadioOptions): RadioMixin;
export default radio;
