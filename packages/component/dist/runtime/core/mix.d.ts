import type { ElementProps } from '../jsx.ts';
interface MixDescriptor {
    type: (...args: any[]) => unknown;
    args: readonly unknown[];
}
type MixDescriptorRunner = (descriptor: MixDescriptor, index: number, mixinProps: ElementProps) => unknown;
/**
 * Composes an element's `mix` descriptors into its final props.
 *
 * @param hostType Host element tag name the mixins are composed for.
 * @param props Original element props, including `mix`.
 * @param runDescriptor Runs each mixin using the caller's state and error handling.
 * @returns The composed props.
 */
export declare function composeMixedProps(hostType: string, props: ElementProps, runDescriptor: MixDescriptorRunner): ElementProps;
export declare function resolveMixDescriptors(props: ElementProps): MixDescriptor[];
export declare function isMixinDescriptor(value: unknown): value is MixDescriptor;
export declare function isMixinElementFunction(value: unknown): value is ((...args: unknown[]) => unknown) & {
    __rmxMixinElementType: string;
};
export {};
