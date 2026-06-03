import type { FrameHandle } from '../component.ts';
import type { ElementProps } from '../jsx.ts';
import type { Scheduler } from '../scheduler.ts';
import type { MixinContext, MixinHandle, MixinReturn, MixinRuntimeType } from './mixin-descriptor.ts';
export { createMixin, renderMixinElement } from './mixin-descriptor.ts';
export type { MixInput, MixValue, MixinDescriptor, MixinFactory, MixinHandle, MixinProps, MixinType, } from './mixin-descriptor.ts';
type AnyMixinType = MixinRuntimeType<unknown[], Element, ElementProps>;
type AnyMixinRunner = (...args: [...unknown[], currentProps: ElementProps]) => MixinReturn<Element, ElementProps>;
type AnyMixinHandle = MixinHandle<Element, ElementProps>;
type RunnerEntry = {
    type: AnyMixinType;
    runner: AnyMixinRunner;
    scope: symbol;
};
export type MixinRuntimeBinding = {
    node: Element;
    parent: ParentNode;
    key?: string;
    target: unknown;
    frame: FrameHandle;
    scheduler: Scheduler;
    enqueueUpdate(done: (signal: AbortSignal) => void): void;
};
type ResolveMixedPropsInput = {
    hostType: string;
    frame: FrameHandle;
    scheduler: Scheduler;
    getContext?: MixinContext['get'];
    props: ElementProps;
    state?: MixinRuntimeState;
};
type ResolveMixedPropsOutput = {
    props: ElementProps;
    state: MixinRuntimeState;
};
export type MixinRuntimeState = {
    id: string;
    controller?: AbortController;
    aborted: boolean;
    handle?: AnyMixinHandle;
    runners: RunnerEntry[];
    binding?: MixinRuntimeBinding;
    removePrepared?: boolean;
    pendingRemoval?: {
        signal: AbortSignal;
        cancel: (reason?: unknown) => void;
        done: Promise<void>;
    };
};
export declare function resolveMixedProps(input: ResolveMixedPropsInput): ResolveMixedPropsOutput;
export declare function teardownMixins(state?: MixinRuntimeState): void;
export declare function bindMixinRuntime(state: MixinRuntimeState | undefined, binding?: MixinRuntimeBinding, options?: {
    dispatchReclaimed?: boolean;
}): void;
export declare function prepareMixinRemoval(state?: MixinRuntimeState): Promise<void> | undefined;
export declare function cancelPendingMixinRemoval(state?: MixinRuntimeState, reason?: unknown): void;
export declare function getMixinRuntimeSignal(state: MixinRuntimeState): AbortSignal;
export declare function dispatchMixinUpdateEvent(state: MixinRuntimeState | undefined, type: 'beforeUpdate' | 'commit'): void;
