import type { ElementProps } from '../jsx.ts';
export declare const MAX_MIX_DESCRIPTORS = 1024;
/**
 * Structural shape of a mixin descriptor as stored in the `mix` prop, shared
 * by the client runtime and the server renderer.
 */
export interface MixDescriptor {
    type: (...args: any[]) => unknown;
    args: readonly unknown[];
}
/**
 * Environment hook that runs one descriptor and returns the mixin's raw
 * result.
 *
 * The client runs descriptors against persistent per-element state (scopes,
 * lifecycle events) and lets mixin errors propagate; the server creates a
 * one-shot runner per descriptor and isolates errors. Returning a falsy value
 * skips the descriptor.
 */
export type MixDescriptorRunner = (descriptor: MixDescriptor, index: number, mixinProps: ElementProps) => unknown;
/**
 * Composes an element's `mix` descriptors into its final props.
 *
 * This is the owner of mixin composition semantics: descriptor expansion,
 * host type validation, returned-prop sanitization, and prop merge order.
 * Both the client reconciler and the server renderer run this loop, supplying
 * their own `runDescriptor`. (The one exception is the reconciler's all-`on()`
 * fast path, which applies event-listener-only mixes without composing.)
 *
 * @param hostType Host element tag name the mixins are composed for.
 * @param props Original element props, including `mix`.
 * @param runDescriptor Environment hook that runs each descriptor.
 * @returns The composed props.
 */
export declare function composeMixedProps(hostType: string, props: ElementProps, runDescriptor: MixDescriptorRunner): ElementProps;
export declare function resolveMixDescriptors(props: ElementProps): MixDescriptor[];
export declare function isMixinDescriptor(value: unknown): value is MixDescriptor;
export declare function isMixinElementFunction(value: unknown): value is ((...args: unknown[]) => unknown) & {
    __rmxMixinElementType: string;
};
