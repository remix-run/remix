import type { CSSMixinDescriptor, ElementProps, MixinDescriptor } from '@remix-run/ui';
export type CheckboxSize = 'md' | 'lg';
export type CheckboxState = 'checked' | 'mixed' | 'unchecked';
export interface CheckboxOptions {
    size?: CheckboxSize;
    state?: CheckboxState;
}
type CheckboxMixin = readonly [
    MixinDescriptor<Element, [state?: CheckboxState], ElementProps>,
    CSSMixinDescriptor,
    CSSMixinDescriptor
];
export declare function checkbox(options?: CheckboxOptions): CheckboxMixin;
export default checkbox;
