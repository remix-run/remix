import type { CSSMixinDescriptor } from '@remix-run/ui';
export type InputSize = 'md' | 'lg';
export interface InputOptions {
    size?: InputSize;
}
type InputMixin = readonly [CSSMixinDescriptor, CSSMixinDescriptor];
interface InputFunction {
    (options?: InputOptions): InputMixin;
    root(options?: InputOptions): InputMixin;
    field(): CSSMixinDescriptor;
}
export declare const input: InputFunction;
export default input;
