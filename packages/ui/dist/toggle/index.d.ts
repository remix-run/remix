import type { CSSMixinDescriptor, ElementProps, MixinDescriptor } from '@remix-run/ui';
export { ToggleChangeEvent, onToggleChange } from '@remix-run/ui/toggle/primitives';
export type ToggleSize = 'md' | 'lg';
export interface ToggleOptions {
    size?: ToggleSize;
}
type ToggleMixin = readonly [MixinDescriptor<Element, [], ElementProps>, CSSMixinDescriptor];
export declare function toggle(options?: ToggleOptions): ToggleMixin;
export default toggle;
