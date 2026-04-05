import type { FrameHandle } from './component.ts';
import type { ElementProps, RemixElement } from './jsx.ts';
import type { Scheduler } from './scheduler.ts';
import { TypedEventTarget } from './typed-event-target.ts';
type RebindNode<value, baseNode, boundNode> = value extends (...args: infer fnArgs) => infer fnResult ? (...args: RebindTuple<fnArgs, baseNode, boundNode>) => RebindNode<fnResult, baseNode, boundNode> : [value] extends [baseNode] ? [baseNode] extends [value] ? boundNode : value : value;
type RebindTuple<args extends unknown[], baseNode, boundNode> = {
    [index in keyof args]: RebindNode<args[index], baseNode, boundNode>;
};
export type MixinProps<node extends EventTarget = Element, props extends ElementProps = ElementProps> = props & {
    mix?: MixValue<node, props>;
};
export type MixinElement<node extends EventTarget = Element, props extends ElementProps = ElementProps> = ((handle: {
    update(): Promise<AbortSignal>;
}, setup: unknown) => (props: MixinProps<node, props>) => RemixElement) & {
    __rmxMixinElementType: string;
};
export type MixinInsertEvent<node extends EventTarget = Element> = Event & {
    node: node;
    parent: ParentNode;
    key?: string;
};
export type MixinReclaimedEvent<node extends EventTarget = Element> = Event & {
    node: node;
    parent: ParentNode;
    key?: string;
};
export type MixinUpdateEvent<node extends EventTarget = Element> = Event & {
    node: node;
};
export type MixinBeforeRemoveEvent = Event & {
    persistNode(teardown: (signal: AbortSignal) => void | Promise<void>): void;
};
type MixinHandleEventMap<node extends EventTarget = Element> = {
    beforeRemove: MixinBeforeRemoveEvent;
    reclaimed: MixinReclaimedEvent<node>;
    remove: Event;
    insert: MixinInsertEvent<node>;
    beforeUpdate: MixinUpdateEvent<node>;
    commit: MixinUpdateEvent<node>;
};
/**
 * Runtime handle passed to mixin setup functions.
 */
export type MixinHandle<node extends EventTarget = Element, props extends ElementProps = ElementProps> = TypedEventTarget<MixinHandleEventMap<node>> & {
    id: string;
    frame: FrameHandle;
    element: MixinElement<node, props>;
    signal: AbortSignal;
    update(): Promise<AbortSignal>;
    queueTask(task: (node: node, signal: AbortSignal) => void): void;
};
export declare function renderMixinElement<node extends EventTarget = Element, props extends ElementProps = ElementProps>(element: MixinElement<node, props>, props?: MixinProps<node, props>): RemixElement;
type MixinRuntimeType<args extends unknown[] = [], node extends EventTarget = Element, props extends ElementProps = ElementProps> = (handle: MixinHandle<node, props>, type: string) => ((...args: [...args, currentProps: props]) => void | null | RemixElement | MixinElement<node, props>) | void;
/**
 * Public mixin setup function signature.
 */
export type MixinType<node extends EventTarget = Element, args extends unknown[] = [], props extends ElementProps = ElementProps> = (handle: MixinHandle<node, props>, type: string) => ((...args: [...args, currentProps: props]) => void | null | RemixElement | MixinElement<node, props>) | void;
/**
 * Serializable descriptor stored in the `mix` prop.
 */
export type MixinDescriptor<node extends EventTarget = Element, args extends unknown[] = [], props extends ElementProps = ElementProps> = {
    type: MixinRuntimeType<args, node, props>;
    args: args;
    readonly __node?: (node: node) => void;
};
/**
 * Accepted value shape for the `mix` prop.
 */
export type MixValue<node extends EventTarget = Element, props extends ElementProps = ElementProps> = MixinDescriptor<node, any, props> | ReadonlyArray<MixinDescriptor<node, any, props>>;
type AnyMixinType = MixinRuntimeType<unknown[], Element, ElementProps>;
type AnyMixinRunner = (...args: [...unknown[], currentProps: ElementProps]) => void | null | RemixElement | MixinElement<Element, ElementProps>;
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
/**
 * Creates a typed mixin factory that can be passed through the `mix` prop.
 *
 * @param type Mixin setup function.
 * @returns A function that captures mixin arguments and returns a descriptor.
 */
export declare function createMixin<node extends EventTarget = Element, args extends unknown[] = [], props extends ElementProps = ElementProps>(type: MixinType<node, args, props>): <boundNode extends node = node>(...args: RebindTuple<args, node, boundNode>) => MixinDescriptor<boundNode, RebindTuple<args, node, boundNode>, props>;
export declare function resolveMixedProps(input: ResolveMixedPropsInput): ResolveMixedPropsOutput;
export declare function teardownMixins(state?: MixinRuntimeState): void;
export declare function bindMixinRuntime(state: MixinRuntimeState | undefined, binding?: MixinRuntimeBinding, options?: {
    dispatchReclaimed?: boolean;
}): void;
export declare function prepareMixinRemoval(state?: MixinRuntimeState): Promise<void> | undefined;
export declare function cancelPendingMixinRemoval(state?: MixinRuntimeState, reason?: unknown): void;
export declare function getMixinRuntimeSignal(state: MixinRuntimeState): AbortSignal;
export declare function dispatchMixinBeforeUpdate(state?: MixinRuntimeState): void;
export declare function dispatchMixinCommit(state?: MixinRuntimeState): void;
export {};
